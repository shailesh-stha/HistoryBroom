import { matchesAny, historyStartTime, filterHistoryMatches, filterDownloadMatches, selectTabsToAct } from './matching.js';
import { DEFAULTS } from './defaults.js';

async function getConfig() {
  const localData = await chrome.storage.local.get({ enableSync: false });
  const storageArea = localData.enableSync ? chrome.storage.sync : chrome.storage.local;
  const data = await storageArea.get(DEFAULTS);
  let changed = false;

  // Migrate legacy v1.x string[] keywords to [{ text, mode, range }]
  if (data.keywords.length && typeof data.keywords[0] === 'string') {
    data.keywords = data.keywords.map((text) => ({ text: text.toLowerCase().trim(), mode: 'substring', range: 'all' }));
    changed = true;
  } else if (data.keywords.length && data.keywords.some(k => !k.range)) {
    data.keywords = data.keywords.map((k) => ({ text: k.text, mode: k.mode, range: k.range || 'all' }));
    changed = true;
  }

  if (changed) {
    await storageArea.set({ keywords: data.keywords });
  }
  return data;
}

// --- Collection (shared by preview and cleanup) ---
// Fetch + filter are split so the actual matching/range/exception decisions
// (the risky, easy-to-get-wrong part) live in matching.js as plain functions
// that can be unit tested without a chrome.* mock. See backup/test_collect.mjs.
async function searchHistory(kw, exceptions) {
  const now = Date.now();
  const text = kw.mode === 'regex' ? '' : kw.text;
  const results = await chrome.history.search({ text, startTime: historyStartTime(kw, now), maxResults: 100000 });
  return filterHistoryMatches(results, kw, exceptions, now);
}

async function searchDownloads(kw, exceptions) {
  const now = Date.now();
  const query = kw.mode === 'regex' ? {} : { query: [kw.text] };
  const results = await chrome.downloads.search(query);
  return filterDownloadMatches(results, kw, exceptions, now);
}

async function collectMatches(cfg) {
  const { keywords, exceptions, protectPinned, protectOpenTabs } = cfg;
  const found = { tabIds: [], urls: [], downloadIds: [], origins: [] };
  if (!keywords.length) return found;

  const origins = new Set();
  const addOrigin = (url) => {
    try { origins.add(new URL(url).origin); } catch {}
  };

  const tabs = await chrome.tabs.query({});
  const tabSelection = selectTabsToAct(tabs, keywords, exceptions, protectPinned, protectOpenTabs);
  found.tabIds = tabSelection.tabIds;
  tabSelection.origins.forEach(addOrigin);

  const urlSet = new Set();
  const dlSet = new Set();
  // Keywords are searched concurrently (each keyword's history+downloads lookups
  // also run concurrently) instead of one sequential await chain per keyword.
  await Promise.all(keywords.map(async (kw) => {
    const [urls, downloads] = await Promise.all([searchHistory(kw, exceptions), searchDownloads(kw, exceptions)]);
    for (const url of urls) {
      urlSet.add(url);
      addOrigin(url);
    }
    for (const { id, url } of downloads) {
      dlSet.add(id);
      if (url) addOrigin(url);
    }
  }));
  found.urls = [...urlSet];
  found.downloadIds = [...dlSet];
  // browsingData origins must be http(s)
  found.origins = [...origins].filter((o) => o.startsWith('http'));
  return found;
}

// --- Core Cleanup ---
let isCleaning = false; // guards the tab-close re-entrancy loop (cleanup closes tabs -> onRemoved fires)

async function performFullCleanup(trigger) {
  if (isCleaning) return null;
  isCleaning = true;
  try {
    const cfg = await getConfig();
    const found = await collectMatches(cfg);
    const result = { tabs: 0, history: 0, downloads: 0 };

    // Each phase is isolated so one failure doesn't abort the rest.
    try {
      if (found.tabIds.length) {
        const removals = await Promise.allSettled(found.tabIds.map(id => chrome.tabs.remove(id)));
        result.tabs = removals.filter(r => r.status === 'fulfilled').length;
      }
    } catch (e) { console.warn('Tab cleanup failed:', e); }

    try {
      const bSize = cfg.batchSize || 100;
      for (let i = 0; i < found.urls.length; i += bSize) {
        const chunk = found.urls.slice(i, i + bSize);
        await Promise.all(chunk.map((url) => chrome.history.deleteUrl({ url })));
        if (i + bSize < found.urls.length) await new Promise((r) => setTimeout(r, 20)); // Small delay to prevent blocking
      }
      result.history = found.urls.length;
    } catch (e) { console.warn('History cleanup failed:', e); }

    try {
      const bSize = cfg.batchSize || 100;
      for (let i = 0; i < found.downloadIds.length; i += bSize) {
        const chunk = found.downloadIds.slice(i, i + bSize);
        await Promise.all(chunk.map((id) => chrome.downloads.erase({ id })));
        if (i + bSize < found.downloadIds.length) await new Promise((r) => setTimeout(r, 20));
      }
      result.downloads = found.downloadIds.length;
    } catch (e) { console.warn('Downloads cleanup failed:', e); }

    if (cfg.cleanSiteData && found.origins.length) {
      try {
        await chrome.browsingData.remove(
          { origins: found.origins },
          { cookies: true, cacheStorage: true, localStorage: true, indexedDB: true, serviceWorkers: true }
        );
      } catch (e) { console.warn('Site-data cleanup failed:', e); }
    }

    if (cfg.deepClean) {
      try {
        await chrome.browsingData.remove({ since: 0 }, { formData: true, cache: true });
      } catch (e) { console.warn('Deep clean failed:', e); }
    }

    await recordRun(result, trigger);
    return result;
  } finally {
    isCleaning = false;
  }
}

async function recordRun(result, trigger) {
  const { stats } = await chrome.storage.local.get({ stats: { runs: 0, tabs: 0, history: 0, downloads: 0 } });
  stats.runs += 1;
  stats.tabs += result.tabs;
  stats.history += result.history;
  stats.downloads += result.downloads;
  await chrome.storage.local.set({
    stats,
    lastRun: { time: Date.now(), trigger, ...result }
  });
}

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'History Broom',
    message,
    priority: 1
  });
}

const summary = (r) => `${r.tabs} tabs, ${r.history} history, ${r.downloads} downloads removed.`;

// --- Badge ---
async function updateBadge() {
  const cfg = await getConfig();
  if (cfg.showBadge && cfg.keywords.length) {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setBadgeText({ text: String(cfg.keywords.length) });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// --- Triggers setup ---
async function setupAlarm() {
  const cfg = await getConfig();
  await chrome.alarms.clear('periodicCleanup');
  if (cfg.autoTimer) {
    // Chrome enforces a 60-second minimum alarm period in production.
    const seconds = Math.max(60, cfg.timerSeconds || DEFAULTS.timerSeconds);
    chrome.alarms.create('periodicCleanup', { periodInMinutes: seconds / 60 });
  }
}

async function setupIdle() {
  const cfg = await getConfig();
  // setDetectionInterval takes seconds, minimum 15.
  chrome.idle.setDetectionInterval(Math.max(15, (cfg.idleMinutes || DEFAULTS.idleMinutes) * 60));
}

async function init() {
  setupAlarm();
  setupIdle();
  updateBadge();
}

// --- Event listeners ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'periodicCleanup') return;
  const result = await performFullCleanup('timer');
  if (result) notify(`Auto-clean: ${summary(result)}`);
});

chrome.tabs.onRemoved.addListener(async () => {
  const cfg = await getConfig();
  if (cfg.autoTab && cfg.keywords.length) await performFullCleanup('tab-close');
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state !== 'idle') return;
  const cfg = await getConfig();
  if (cfg.autoIdle && cfg.keywords.length) await performFullCleanup('idle');
});

// Real-time scrub: delete matching history entries the moment they are recorded.
chrome.history.onVisited.addListener(async (item) => {
  const cfg = await getConfig();
  if (!cfg.realtimeClean || !cfg.keywords.length) return;
  if (matchesAny(cfg.keywords, cfg.exceptions, item.title, item.url)) {
    try { await chrome.history.deleteUrl({ url: item.url }); } catch {}
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'panic-clean') {
    const result = await performFullCleanup('panic');
    if (result) notify(`Panic clean: ${summary(result)}`);
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  const cfg = await getConfig();
  const activeArea = cfg.enableSync ? 'sync' : 'local';
  if (area === activeArea) {
    if (changes.keywords || changes.showBadge) updateBadge();
    if (changes.autoTimer || changes.timerSeconds) setupAlarm();
    if (changes.autoIdle || changes.idleMinutes) setupIdle();
  }
  if (area === 'local' && changes.enableSync) {
    await init();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await init();
  const cfg = await getConfig();
  if (cfg.cleanOnStartup && cfg.keywords.length) {
    const result = await performFullCleanup('startup');
    if (result) notify(`Startup clean: ${summary(result)}`);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  init();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearAll') {
    performFullCleanup('manual')
      .then((result) => sendResponse(result ? { result } : { error: 'A cleanup is already running.' }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (request.action === 'preview') {
    getConfig()
      .then(collectMatches)
      .then((found) => sendResponse({
        result: { tabs: found.tabIds.length, history: found.urls.length, downloads: found.downloadIds.length }
      }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (request.action === 'previewKeyword') {
    // Impact preview for a single not-yet-saved keyword, used by the popup's
    // broad-match warning. Ignores tab-protection settings so the count
    // reflects everything the keyword would match, not just what gets closed.
    collectMatches({
      keywords: [request.keyword],
      exceptions: request.exceptions || [],
      protectPinned: false,
      protectOpenTabs: false
    })
      .then((found) => sendResponse({
        result: { tabs: found.tabIds.length, history: found.urls.length, downloads: found.downloadIds.length }
      }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (request.action === 'updateTimer') setupAlarm();
  if (request.action === 'updateIdle') setupIdle();
});
