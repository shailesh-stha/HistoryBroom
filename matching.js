// Pure keyword-matching logic, shared by background.js and test_matching.mjs.
// Keyword shape: { text: string, mode: 'substring' | 'word' | 'domain' | 'regex' }

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hostMatches(url, domain) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === domain || h.endsWith('.' + domain);
  } catch {
    return false;
  }
}

export function matches(kw, title, url) {
  const maxLen = 2048;
  const safeTitle = (title || '').slice(0, maxLen);
  const safeUrl = (url || '').slice(0, maxLen);

  switch (kw.mode) {
    case 'word':
      return new RegExp(`\\b${escapeRegex(kw.text)}\\b`, 'i').test(safeTitle + ' ' + safeUrl);
    case 'domain':
      return hostMatches(safeUrl, kw.text);
    case 'regex':
      try {
        const r = new RegExp(kw.text, 'i');
        return r.test(safeTitle) || r.test(safeUrl);
      } catch {
        return false; // invalid pattern never matches
      }
    default: // substring
      return safeTitle.toLowerCase().includes(kw.text) ||
             safeUrl.toLowerCase().includes(kw.text);
  }
}

export function isExcepted(exceptions, title, url) {
  const maxLen = 2048;
  const t = (title || '').slice(0, maxLen).toLowerCase();
  const u = (url || '').slice(0, maxLen).toLowerCase();
  return exceptions.some((e) => t.includes(e) || u.includes(e));
}

export function matchesAny(keywords, exceptions, title, url) {
  return !isExcepted(exceptions, title, url) && keywords.some((k) => matches(k, title, url));
}

// --- Cleanup selection logic (pure; chrome.* I/O lives in background.js) ---

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// chrome.history.search's startTime for a keyword's range. 'older30d' has no
// startTime equivalent (it needs a post-fetch filter, see filterHistoryMatches).
export function historyStartTime(kw, now) {
  if (kw.range === '1h') return now - HOUR;
  if (kw.range === '24h') return now - DAY;
  if (kw.range === '7d') return now - 7 * DAY;
  return 0;
}

// Given raw chrome.history.search results, keep only ones this keyword
// actually matches (title/url + range + not excepted). Returns matched URLs.
export function filterHistoryMatches(results, kw, exceptions, now) {
  return results
    .filter((h) => h.url && matches(kw, h.title, h.url) && !isExcepted(exceptions, h.title, h.url))
    .filter((h) => kw.range !== 'older30d' || h.lastVisitTime < now - 30 * DAY)
    .map((h) => h.url);
}

function downloadWithinRange(d, kw, now) {
  if (!kw.range || kw.range === 'all') return true;
  const downloadTime = d.startTime ? new Date(d.startTime).getTime() : 0;
  if (!downloadTime) return false;
  const diff = now - downloadTime;
  switch (kw.range) {
    case '1h': return diff <= HOUR;
    case '24h': return diff <= DAY;
    case '7d': return diff <= 7 * DAY;
    case 'older30d': return diff > 30 * DAY;
    default: return true;
  }
}

// Given raw chrome.downloads.search results, keep only ones this keyword
// actually matches (filename/url + range + not excepted). Returns {id, url} pairs.
export function filterDownloadMatches(results, kw, exceptions, now) {
  return results
    .filter((d) => matches(kw, d.filename, d.url || d.finalUrl))
    .filter((d) => downloadWithinRange(d, kw, now))
    .filter((d) => !isExcepted(exceptions, d.filename, d.url || d.finalUrl))
    .map((d) => ({ id: d.id, url: d.url || d.finalUrl }));
}

// Given open tabs, decide which ones this keyword set matches AND should be
// closed (respecting protectPinned/protectOpenTabs). Only tabs actually being
// closed contribute their origin, so a protected tab's site data is never
// touched by a caller that treats these origins as a browsingData.remove scope.
export function selectTabsToAct(tabs, keywords, exceptions, protectPinned, protectOpenTabs) {
  const tabIds = [];
  const origins = [];
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    if (!matchesAny(keywords, exceptions, tab.title, tab.url)) continue;
    const shouldClose = !protectOpenTabs && (!protectPinned || !tab.pinned);
    if (shouldClose) {
      tabIds.push(tab.id);
      if (tab.url) origins.push(tab.url);
    }
  }
  return { tabIds, origins };
}
