import { DEFAULTS, CONFIG_DEFAULTS, LOCAL_ONLY_KEYS } from './defaults.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // Sections
  const lockScreen = $('lockScreen');
  const main = $('main');
  const detailsKeywords = $('detailsKeywords');
  const detailsExceptions = $('detailsExceptions');
  const detailsSettings = $('detailsSettings');


  // Keyword / exception controls
  const keywordInput = $('keywordInput');
  const modeSelect = $('modeSelect');
  const rangeSelect = $('rangeSelect');
  const addBtn = $('addBtn');
  const keywordListUI = $('keywordList');
  const exceptionInput = $('exceptionInput');
  const addExceptionBtn = $('addExceptionBtn');
  const exceptionListUI = $('exceptionList');

  // Toggles & inputs
  const autoTabToggle = $('autoTabToggle');
  const startupToggle = $('startupToggle');
  const realtimeToggle = $('realtimeToggle');
  const idleToggle = $('idleToggle');
  const idleMinsInput = $('idleMins');
  const timerToggle = $('timerToggle');
  const timerSecsInput = $('timerSecs');
  const siteDataToggle = $('siteDataToggle');
  const protectPinnedToggle = $('protectPinnedToggle');
  const protectOpenTabsToggle = $('protectOpenTabsToggle');
  const showBadgeToggle = $('showBadgeToggle');
  const enableSyncToggle = $('enableSyncToggle');
  const deepCleanToggle = $('deepCleanToggle');
  const batchSizeInput = $('batchSize');

  // PIN / import-export
  const pinEntry = $('pinEntry');
  const unlockBtn = $('unlockBtn');
  const pinInput = $('pinInput');
  const setPinBtn = $('setPinBtn');
  const exportBtn = $('exportBtn');
  const importBtn = $('importBtn');
  const importFile = $('importFile');
  const resetBtn = $('resetBtn');

  // Actions & status
  const previewBtn = $('previewBtn');
  const clearBtn = $('clearBtn');
  const statsBar = $('statsBar');
  const statusDiv = $('status');
  const statusText = $('statusText');
  const statusClose = $('statusClose');

  let savedKeywords = [];   // [{ text, mode, range }]
  let savedExceptions = []; // [string]
  let clearArmed = false;
  let armTimeout = null;

  const MODE_LABELS = { substring: 'contains', word: 'word', domain: 'domain', regex: 'regex' };
  const RANGE_LABELS = { all: 'all time', '1h': '1h', '24h': '24h', '7d': '7d', older30d: '>30d' };

  async function getSettings(keysWithDefaults) {
    const localData = await chrome.storage.local.get({ enableSync: false });
    const area = localData.enableSync ? chrome.storage.sync : chrome.storage.local;
    const requestedLocalKeys = {};
    const requestedSharedKeys = {};

    for (const [key, val] of Object.entries(keysWithDefaults)) {
      if (LOCAL_ONLY_KEYS.includes(key)) {
        requestedLocalKeys[key] = val;
      } else {
        requestedSharedKeys[key] = val;
      }
    }

    const [localResult, sharedResult] = await Promise.all([
      chrome.storage.local.get(requestedLocalKeys),
      area.get(requestedSharedKeys)
    ]);

    return { ...localResult, ...sharedResult };
  }

  async function setSettings(items) {
    try {
      const localData = await chrome.storage.local.get({ enableSync: false });
      const area = localData.enableSync ? chrome.storage.sync : chrome.storage.local;
      const localItems = {};
      const sharedItems = {};

      for (const [key, val] of Object.entries(items)) {
        if (LOCAL_ONLY_KEYS.includes(key)) {
          localItems[key] = val;
        } else {
          sharedItems[key] = val;
        }
      }

      const promises = [];
      if (Object.keys(localItems).length > 0) {
        promises.push(chrome.storage.local.set(localItems));
      }
      if (Object.keys(sharedItems).length > 0) {
        promises.push(area.set(sharedItems));
      }
      await Promise.all(promises);
    } catch (e) {
      console.error('Storage write failed:', e);
      showStatus('Storage error: ' + (e.message || 'Quota exceeded or write failed'), true);
      throw e;
    }
  }

  let statusTimeout = null;
  function showStatus(message, isError = false) {
    clearTimeout(statusTimeout);
    statusText.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
    void statusDiv.offsetWidth; // Force layout reflow to register class transition reset
    statusDiv.classList.add('show');
    statusTimeout = setTimeout(() => {
      statusDiv.classList.remove('show');
    }, 4000);
  }

  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const BROAD_MATCH_THRESHOLD = 20;

  // Asks background.js how many tabs/history/downloads this (not-yet-saved)
  // keyword would currently match, so the "broad match" warning covers any
  // keyword with real impact, not just a hardcoded list of famous domains.
  // Returns null (fails open, no warning) if the background page can't be reached.
  function previewKeywordImpact(kw) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'previewKeyword', keyword: kw, exceptions: savedExceptions }, (response) => {
        if (chrome.runtime.lastError || !response || response.error) return resolve(null);
        const r = response.result;
        resolve(r.tabs + r.history + r.downloads);
      });
    });
  }

  async function confirmBroadMatch(kw) {
    if (kw.mode === 'regex') return true; // regex impact is already opt-in/advanced; skip the extra round trip
    const impact = await previewKeywordImpact(kw);
    if (impact === null || impact <= BROAD_MATCH_THRESHOLD) return true;
    return confirm(
      `Warning: "${kw.text}" currently matches ${impact} tabs/history/download entries. ` +
      `Scrubbing this keyword will close active tabs and wipe historical logs for all of them. Do you want to proceed?`
    );
  }

  // --- Rendering (no innerHTML with user data: XSS-safe) ---
  let editingKeywordIndex = null;
  let editingExceptionIndex = null;

  async function saveEditKeyword(index, val, newMode, newRange) {
    let text = val.trim();
    if (!text) return showStatus('Keyword cannot be empty.', true);

    if (newMode === 'substring' && text.length < 3) {
      return showStatus('Keywords must be at least 3 characters in contains mode to avoid accidental broad sweeps.', true);
    }

    if (newMode !== 'regex') text = text.toLowerCase();
    if (newMode === 'regex') {
      try { new RegExp(text); } catch { return showStatus('Invalid regex pattern.', true); }
    }

    if (!(await confirmBroadMatch({ text, mode: newMode, range: newRange }))) return;

    // Check duplicates (excluding current index)
    if (savedKeywords.some((k, i) => i !== index && k.text === text && k.mode === newMode && k.range === newRange)) {
      return showStatus('Already in the list.', true);
    }

    savedKeywords[index].text = text;
    savedKeywords[index].mode = newMode;
    savedKeywords[index].range = newRange;
    editingKeywordIndex = null;
    setSettings({ keywords: savedKeywords }).then(renderKeywords);
  }

  function saveEditException(index, val) {
    const word = val.trim().toLowerCase();
    if (!word) return showStatus('Exception cannot be empty.', true);

    // Check duplicates (excluding current index)
    if (savedExceptions.some((e, i) => i !== index && e === word)) {
      return showStatus('Already in the list.', true);
    }

    savedExceptions[index] = word;
    editingExceptionIndex = null;
    setSettings({ exceptions: savedExceptions }).then(renderExceptions);
  }

  function renderKeywords() {
    keywordListUI.textContent = '';
    if (!savedKeywords.length) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'No keywords added yet.';
      keywordListUI.appendChild(li);
      return;
    }
    savedKeywords.forEach((kw, index) => {
      const li = document.createElement('li');
      li.className = 'keyword-item';

      if (editingKeywordIndex === index) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = kw.text;
        input.style.flex = '1';
        input.style.minWidth = '0';
        input.style.padding = '2px 4px';
        input.style.fontSize = '0.92em';
        input.style.border = '1px solid var(--border)';
        input.style.borderRadius = '4px';
        input.style.background = 'var(--bg)';
        input.style.color = 'var(--fg)';

        const modeSel = document.createElement('select');
        modeSel.style.fontSize = '0.85em';
        modeSel.style.padding = '2px';
        modeSel.style.border = '1px solid var(--border)';
        modeSel.style.borderRadius = '4px';
        modeSel.style.background = 'var(--bg)';
        modeSel.style.color = 'var(--fg)';
        modeSel.style.maxWidth = '75px';
        
        const modes = [
          { val: 'substring', label: 'contains' },
          { val: 'word', label: 'word' },
          { val: 'domain', label: 'domain' },
          { val: 'regex', label: 'regex' }
        ];
        modes.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.val;
          opt.textContent = m.label;
          if (m.val === kw.mode) opt.selected = true;
          modeSel.appendChild(opt);
        });

        const rangeSel = document.createElement('select');
        rangeSel.style.fontSize = '0.85em';
        rangeSel.style.padding = '2px';
        rangeSel.style.border = '1px solid var(--border)';
        rangeSel.style.borderRadius = '4px';
        rangeSel.style.background = 'var(--bg)';
        rangeSel.style.color = 'var(--fg)';
        rangeSel.style.maxWidth = '70px';

        const ranges = [
          { val: 'all', label: 'all time' },
          { val: '1h', label: '1h' },
          { val: '24h', label: '24h' },
          { val: '7d', label: '7d' },
          { val: 'older30d', label: '>30d' }
        ];
        ranges.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.val;
          opt.textContent = r.label;
          if (r.val === (kw.range || 'all')) opt.selected = true;
          rangeSel.appendChild(opt);
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '✓';
        saveBtn.setAttribute('aria-label', `Save keyword ${kw.text}`);
        saveBtn.title = 'Save changes';
        saveBtn.style.background = 'var(--accent)';
        saveBtn.style.color = 'white';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '4px';
        saveBtn.style.padding = '2px 6px';
        saveBtn.style.cursor = 'pointer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = '⟲';
        cancelBtn.setAttribute('aria-label', `Cancel editing keyword ${kw.text}`);
        cancelBtn.title = 'Cancel editing';
        cancelBtn.style.background = 'var(--danger)';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.padding = '2px 6px';
        cancelBtn.style.cursor = 'pointer';

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveEditKeyword(index, input.value, modeSel.value, rangeSel.value);
          if (e.key === 'Escape') {
            editingKeywordIndex = null;
            renderKeywords();
          }
        });

        saveBtn.addEventListener('click', () => saveEditKeyword(index, input.value, modeSel.value, rangeSel.value));
        cancelBtn.addEventListener('click', () => {
          editingKeywordIndex = null;
          renderKeywords();
        });

        li.append(input, modeSel, rangeSel, saveBtn, cancelBtn);
        setTimeout(() => input.focus(), 10);
      } else {
        const span = document.createElement('span');
        span.className = 'kw-text';
        span.textContent = kw.text;
        span.title = kw.text;

        const chip = document.createElement('span');
        chip.className = 'mode-chip';
        chip.textContent = MODE_LABELS[kw.mode] || kw.mode;

        const rangeChip = document.createElement('span');
        rangeChip.className = 'range-chip';
        rangeChip.textContent = RANGE_LABELS[kw.range] || kw.range || 'all time';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.dataset.index = index;
        editBtn.textContent = '✎';
        editBtn.setAttribute('aria-label', `Edit keyword ${kw.text}`);
        editBtn.title = 'Edit keyword';
        editBtn.style.background = 'none';
        editBtn.style.border = 'none';
        editBtn.style.color = 'var(--muted)';
        editBtn.style.cursor = 'pointer';
        editBtn.style.fontSize = '1em';
        editBtn.style.padding = '2px 6px';
        editBtn.style.display = 'inline-block';
        editBtn.style.transform = 'scaleX(-1)';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.dataset.index = index;
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', `Remove keyword ${kw.text}`);
        deleteBtn.title = 'Delete keyword';

        li.append(span, chip, rangeChip, editBtn, deleteBtn);
      }
      keywordListUI.appendChild(li);
    });
  }

  function renderExceptions() {
    exceptionListUI.textContent = '';
    if (!savedExceptions.length) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'No exceptions. Matches here are always kept.';
      exceptionListUI.appendChild(li);
      return;
    }
    savedExceptions.forEach((word, index) => {
      const li = document.createElement('li');
      li.className = 'keyword-item';

      if (editingExceptionIndex === index) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = word;
        input.style.flex = '1';
        input.style.minWidth = '0';
        input.style.padding = '2px 4px';
        input.style.fontSize = '0.92em';
        input.style.border = '1px solid var(--border)';
        input.style.borderRadius = '4px';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '✓';
        saveBtn.setAttribute('aria-label', `Save exception ${word}`);
        saveBtn.title = 'Save changes';
        saveBtn.style.background = 'var(--accent)';
        saveBtn.style.color = 'white';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '4px';
        saveBtn.style.padding = '2px 6px';
        saveBtn.style.cursor = 'pointer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = '⟲';
        cancelBtn.setAttribute('aria-label', `Cancel editing exception ${word}`);
        cancelBtn.title = 'Cancel editing';
        cancelBtn.style.background = 'var(--danger)';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.padding = '2px 6px';
        cancelBtn.style.cursor = 'pointer';

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveEditException(index, input.value);
          if (e.key === 'Escape') {
            editingExceptionIndex = null;
            renderExceptions();
          }
        });

        saveBtn.addEventListener('click', () => saveEditException(index, input.value));
        cancelBtn.addEventListener('click', () => {
          editingExceptionIndex = null;
          renderExceptions();
        });

        li.append(input, saveBtn, cancelBtn);
        setTimeout(() => input.focus(), 10);
      } else {
        const span = document.createElement('span');
        span.className = 'kw-text';
        span.textContent = word;

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-exception-btn';
        editBtn.dataset.index = index;
        editBtn.textContent = '✎';
        editBtn.setAttribute('aria-label', `Edit exception ${word}`);
        editBtn.title = 'Edit exception';
        editBtn.style.background = 'none';
        editBtn.style.border = 'none';
        editBtn.style.color = 'var(--muted)';
        editBtn.style.cursor = 'pointer';
        editBtn.style.fontSize = '1em';
        editBtn.style.padding = '2px 6px';
        editBtn.style.display = 'inline-block';
        editBtn.style.transform = 'scaleX(-1)';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.dataset.index = index;
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', `Remove exception ${word}`);
        deleteBtn.title = 'Delete exception';

        li.append(span, editBtn, deleteBtn);
      }
      exceptionListUI.appendChild(li);
    });
  }

  function renderStats(stats, lastRun) {
    if (!lastRun) {
      statsBar.textContent = 'Never cleaned yet.';
      return;
    }
    const when = new Date(lastRun.time).toLocaleString();
    const total = (stats && (stats.tabs + stats.history + stats.downloads)) || 0;
    statsBar.textContent =
      `Last clean (${lastRun.trigger}): ${when}, ${lastRun.tabs} tabs, ` +
      `${lastRun.history} history, ${lastRun.downloads} downloads. ` +
      `Total: ${total} items over ${stats ? stats.runs : 0} runs.`;
  }

  // --- Load all settings & UI state ---
  getSettings(DEFAULTS).then((data) => {
    // Populates the UI with fetched settings/keywords. Deliberately not called
    // until the PIN gate (if any) is passed, so a locked popup never puts
    // keywords/exceptions/stats into the DOM where devtools could read them.
    function populateUI() {
      // Migrate legacy string[] keywords for display (background also persists this)
      savedKeywords = data.keywords.map((k) => {
        if (typeof k === 'string') {
          return { text: k.toLowerCase().trim(), mode: 'substring', range: 'all' };
        }
        return { text: k.text, mode: k.mode, range: k.range || 'all' };
      });
      savedExceptions = data.exceptions;

      autoTabToggle.checked = data.autoTab;
      startupToggle.checked = data.cleanOnStartup;
      realtimeToggle.checked = data.realtimeClean;
      idleToggle.checked = data.autoIdle;
      idleMinsInput.value = data.idleMinutes;
      timerToggle.checked = data.autoTimer;
      timerSecsInput.value = data.timerSeconds;
      siteDataToggle.checked = data.cleanSiteData;
      protectPinnedToggle.checked = data.protectPinned;
      protectOpenTabsToggle.checked = data.protectOpenTabs;
      showBadgeToggle.checked = data.showBadge;
      enableSyncToggle.checked = data.enableSync;
      deepCleanToggle.checked = data.deepClean;
      batchSizeInput.value = data.batchSize;

      detailsKeywords.open = data.uiStateKeywords;
      detailsExceptions.open = data.uiStateExceptions;
      detailsSettings.open = data.uiStateSettings;

      renderKeywords();
      renderExceptions();
      renderStats(data.stats, data.lastRun);
    }

    // PIN gate
    if (data.pinHash) {
      lockScreen.hidden = false;
      pinEntry.focus();
      let failedAttempts = 0;
      const tryUnlock = async () => {
        if (await sha256(pinEntry.value) === data.pinHash) {
          failedAttempts = 0;
          lockScreen.hidden = true;
          populateUI();
          main.hidden = false;
          return;
        }
        pinEntry.value = '';
        failedAttempts++;
        // After 5 wrong tries, back off with a growing delay (capped at 30s)
        // to slow down brute-forcing the PIN from the popup UI.
        if (failedAttempts >= 5) {
          const delayMs = Math.min(30000, 2 ** (failedAttempts - 5) * 1000);
          pinEntry.disabled = true;
          unlockBtn.disabled = true;
          pinEntry.placeholder = `Too many attempts, wait ${Math.ceil(delayMs / 1000)}s`;
          setTimeout(() => {
            pinEntry.disabled = false;
            unlockBtn.disabled = false;
            pinEntry.placeholder = 'Enter PIN';
            pinEntry.focus();
          }, delayMs);
        } else {
          pinEntry.placeholder = 'Wrong PIN';
        }
      };
      unlockBtn.addEventListener('click', tryUnlock);
      pinEntry.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
    } else {
      populateUI();
      main.hidden = false;
    }
  });

  // --- Accordion state persistence ---
  detailsKeywords.addEventListener('toggle', () =>
    setSettings({ uiStateKeywords: detailsKeywords.open }));
  detailsExceptions.addEventListener('toggle', () =>
    setSettings({ uiStateExceptions: detailsExceptions.open }));
  detailsSettings.addEventListener('toggle', () =>
    setSettings({ uiStateSettings: detailsSettings.open }));


  // --- Keywords ---
  async function addKeyword() {
    const mode = modeSelect.value;
    const range = rangeSelect.value;
    let text = keywordInput.value.trim();
    if (!text) return showStatus('Type a keyword first.', true);

    // Guardrail 1: Minimum length check for contains (substring) matching
    if (mode === 'substring' && text.length < 3) {
      return showStatus('Keywords must be at least 3 characters in contains mode to avoid accidental broad sweeps.', true);
    }

    if (mode !== 'regex') text = text.toLowerCase();
    if (mode === 'regex') {
      try { new RegExp(text); } catch { return showStatus('Invalid regex pattern.', true); }
    }

    // Guardrail 2: Broad-match warning, sized against your actual tabs/history/downloads
    if (!(await confirmBroadMatch({ text, mode, range }))) return;

    if (savedKeywords.some((k) => k.text === text && k.mode === mode && k.range === range)) {
      return showStatus('Already in the list.', true);
    }
    savedKeywords.push({ text, mode, range });
    setSettings({ keywords: savedKeywords }).then(renderKeywords);
    keywordInput.value = '';
    keywordInput.focus();
  }
  addBtn.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addKeyword(); });

  keywordListUI.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const idx = Number(e.target.dataset.index);
      savedKeywords.splice(idx, 1);
      if (editingKeywordIndex === idx) {
        editingKeywordIndex = null;
      } else if (editingKeywordIndex > idx) {
        editingKeywordIndex--;
      }
      setSettings({ keywords: savedKeywords }).then(renderKeywords);
    } else if (e.target.classList.contains('edit-btn')) {
      editingKeywordIndex = Number(e.target.dataset.index);
      renderKeywords();
    }
  });

  // --- Exceptions ---
  function addException() {
    const word = exceptionInput.value.trim().toLowerCase();
    if (!word) return showStatus('Type an exception first.', true);
    if (savedExceptions.includes(word)) return showStatus('Already in the list.', true);
    savedExceptions.push(word);
    setSettings({ exceptions: savedExceptions }).then(renderExceptions);
    exceptionInput.value = '';
    exceptionInput.focus();
  }
  addExceptionBtn.addEventListener('click', addException);
  exceptionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addException(); });

  exceptionListUI.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const idx = Number(e.target.dataset.index);
      savedExceptions.splice(idx, 1);
      if (editingExceptionIndex === idx) {
        editingExceptionIndex = null;
      } else if (editingExceptionIndex > idx) {
        editingExceptionIndex--;
      }
      setSettings({ exceptions: savedExceptions }).then(renderExceptions);
    } else if (e.target.classList.contains('edit-exception-btn')) {
      editingExceptionIndex = Number(e.target.dataset.index);
      renderExceptions();
    }
  });

  // --- Simple toggles ---
  autoTabToggle.addEventListener('change', (e) => setSettings({ autoTab: e.target.checked }));
  startupToggle.addEventListener('change', (e) => setSettings({ cleanOnStartup: e.target.checked }));
  realtimeToggle.addEventListener('change', (e) => setSettings({ realtimeClean: e.target.checked }));
  siteDataToggle.addEventListener('change', (e) => setSettings({ cleanSiteData: e.target.checked }));
  protectPinnedToggle.addEventListener('change', (e) => setSettings({ protectPinned: e.target.checked }));
  protectOpenTabsToggle.addEventListener('change', (e) => setSettings({ protectOpenTabs: e.target.checked }));
  showBadgeToggle.addEventListener('change', (e) => setSettings({ showBadge: e.target.checked }));

  enableSyncToggle.addEventListener('change', async (e) => {
    const enableSync = e.target.checked;
    const oldArea = enableSync ? chrome.storage.local : chrome.storage.sync;
    const newArea = enableSync ? chrome.storage.sync : chrome.storage.local;

    const data = await oldArea.get(CONFIG_DEFAULTS);

    if (enableSync) {
      // chrome.storage.sync caps each individual item at QUOTA_BYTES_PER_ITEM
      // (8KB); a large keyword/exception list would otherwise fail to sync
      // with only a generic "quota exceeded" error after the fact.
      const perItemLimit = chrome.storage.sync.QUOTA_BYTES_PER_ITEM;
      const oversized = Object.entries(data).find(([key, val]) => {
        const bytes = new TextEncoder().encode(key + JSON.stringify(val)).length;
        return bytes > perItemLimit;
      });
      if (oversized) {
        e.target.checked = false;
        showStatus(
          `Can't enable sync: "${oversized[0]}" is too large for Chrome's ${perItemLimit}-byte sync limit per item. Trim your keyword/exception list first.`,
          true
        );
        return;
      }
    }

    await newArea.set(data);
    await chrome.storage.local.set({ enableSync });

    showStatus('Sync settings updated. Reopening...');
    setTimeout(() => location.reload(), 800);
  });

  deepCleanToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      const proceed = confirm(
        "🚨 WARNING: Deep Clean is a high-risk feature!\n\n" +
        "Enabling this will wipe ALL browser cache and autofill form data across ALL websites (not just keyword matches).\n\n" +
        "This action runs during all cleanup tasks (e.g. manual clear, timer, tab-close, or startup).\n\n" +
        "Do you really want to enable Deep Clean?"
      );
      if (!proceed) {
        e.target.checked = false;
        return;
      }
    }
    setSettings({ deepClean: e.target.checked });
  });

  batchSizeInput.addEventListener('change', () => {
    let size = parseInt(batchSizeInput.value, 10);
    if (!Number.isFinite(size) || size < 1) size = 100;
    batchSizeInput.value = size;
    setSettings({ batchSize: size });
  });

  // --- Idle settings (validated, clamped) ---
  function updateIdleSettings() {
    let mins = parseInt(idleMinsInput.value, 10);
    if (!Number.isFinite(mins) || mins < 1) mins = 5;
    idleMinsInput.value = mins;
    setSettings({ autoIdle: idleToggle.checked, idleMinutes: mins }).then(() =>
      chrome.runtime.sendMessage({ action: 'updateIdle' }));
  }
  idleToggle.addEventListener('change', updateIdleSettings);
  idleMinsInput.addEventListener('change', updateIdleSettings);

  // --- Timer settings (Chrome alarm floor is 60s in production) ---
  function updateTimerSettings() {
    let seconds = parseInt(timerSecsInput.value, 10);
    if (!Number.isFinite(seconds)) seconds = 60;
    if (seconds < 60) { seconds = 60; showStatus('Chrome allows 60s minimum in production, clamped.', true); }
    timerSecsInput.value = seconds;
    setSettings({ autoTimer: timerToggle.checked, timerSeconds: seconds }).then(() =>
      chrome.runtime.sendMessage({ action: 'updateTimer' }));
  }
  timerToggle.addEventListener('change', updateTimerSettings);
  timerSecsInput.addEventListener('change', updateTimerSettings);

  // --- PIN ---
  setPinBtn.addEventListener('click', async () => {
    const pin = pinInput.value.trim();
    if (!pin) {
      setSettings({ pinHash: null }).then(() => showStatus('PIN removed.'));
    } else {
      setSettings({ pinHash: await sha256(pin) }).then(() => showStatus('PIN set.'));
    }
    pinInput.value = '';
  });

  // --- Export / Import ---
  exportBtn.addEventListener('click', () => {
    getSettings(CONFIG_DEFAULTS).then((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'historybroom-settings.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });

  function sanitizeImportData(data) {
    const clean = {};
    const booleanKeys = ['autoTab', 'autoIdle', 'deepClean', 'cleanSiteData', 'autoTimer', 'realtimeClean', 'cleanOnStartup', 'protectPinned', 'protectOpenTabs', 'enableSync', 'showBadge'];
    const numberKeys = { idleMinutes: 1, timerSeconds: 60, batchSize: 1 };
    
    for (const key of booleanKeys) {
      if (key in data) clean[key] = Boolean(data[key]);
    }
    
    for (const [key, minVal] of Object.entries(numberKeys)) {
      if (key in data) {
        let val = parseInt(data[key], 10);
        if (!Number.isFinite(val) || val < minVal) val = minVal;
        clean[key] = val;
      }
    }
    
    if (Array.isArray(data.keywords)) {
      const cleanKeywords = [];
      const validModes = ['substring', 'word', 'domain', 'regex'];
      const validRanges = ['all', '1h', '24h', '7d', 'older30d'];
      for (const kw of data.keywords) {
        if (typeof kw === 'string') {
          cleanKeywords.push({ text: kw.toLowerCase().trim(), mode: 'substring', range: 'all' });
        } else if (kw && typeof kw === 'object' && typeof kw.text === 'string') {
          let text = kw.text.trim();
          const mode = validModes.includes(kw.mode) ? kw.mode : 'substring';
          const range = validRanges.includes(kw.range) ? kw.range : 'all';
          if (mode !== 'regex') text = text.toLowerCase();
          cleanKeywords.push({ text, mode, range });
        }
      }
      clean.keywords = cleanKeywords;
    } else {
      throw new Error('missing keywords');
    }
    
    if (Array.isArray(data.exceptions)) {
      clean.exceptions = data.exceptions
        .filter(e => typeof e === 'string')
        .map(e => e.toLowerCase().trim());
    } else if ('exceptions' in data) {
      clean.exceptions = [];
    }
    
    if ('pinHash' in data) {
      if (typeof data.pinHash === 'string' && /^[a-f0-9]{64}$/i.test(data.pinHash)) {
        clean.pinHash = data.pinHash.toLowerCase();
      } else {
        clean.pinHash = null;
      }
    }
    
    return clean;
  }

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawData = JSON.parse(reader.result);
        const cleanData = sanitizeImportData(rawData);
        setSettings(cleanData).then(() => {
          chrome.runtime.sendMessage({ action: 'updateTimer' });
          chrome.runtime.sendMessage({ action: 'updateIdle' });
          showStatus('Settings imported. Reopening...');
          setTimeout(() => location.reload(), 800);
        });
      } catch (err) {
        showStatus('Invalid import file.', true);
      }
    };
    reader.readAsText(file);
    importFile.value = ''; // reset
  });

  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to completely reset History Broom to its default settings? All keywords, exceptions, and automation settings will be permanently lost. This cannot be undone.')) {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      chrome.runtime.sendMessage({ action: 'updateTimer' });
      chrome.runtime.sendMessage({ action: 'updateIdle' });
      showStatus('Extension reset to defaults. Reopening...', false);
      setTimeout(() => location.reload(), 1500);
    }
  });



  // --- Preview (dry run) ---
  previewBtn.addEventListener('click', () => {
    if (!savedKeywords.length) return showStatus('List is empty!', true);
    previewBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'preview' }, (response) => {
      previewBtn.disabled = false;
      if (chrome.runtime.lastError || !response || response.error) {
        showStatus(response && response.error ? response.error : 'Error connecting...', true);
      } else {
        const r = response.result;
        showStatus(`Would remove: ${r.tabs} tabs, ${r.history} history, ${r.downloads} downloads.`);
      }
    });
  });

  // --- Clear (two-step confirm when Deep Clean is on) ---
  function resetClearBtn() {
    clearArmed = false;
    clearBtn.classList.remove('armed');
    clearBtn.textContent = 'Clear All Now';
  }

  clearBtn.addEventListener('click', () => {
    if (!savedKeywords.length) return showStatus('List is empty!', true);

    getSettings({ stats: null }).then((data) => {
      const isFirstClean = !data.stats || data.stats.runs === 0;
      if (isFirstClean) {
        const proceed = confirm("First-Time Setup:\n\nThis will permanently close all tabs and delete history/download records that match your keywords.\n\nAre you sure you want to proceed with this cleanup?");
        if (!proceed) return;
      }

      if (deepCleanToggle.checked && !clearArmed) {
        clearArmed = true;
        clearBtn.classList.add('armed');
        clearBtn.textContent = 'Confirm Deep Clean?';
        clearTimeout(armTimeout);
        armTimeout = setTimeout(resetClearBtn, 4000);
        return;
      }
      clearTimeout(armTimeout);
      resetClearBtn();

      clearBtn.disabled = true;
      clearBtn.textContent = 'Cleaning…';
      chrome.runtime.sendMessage({ action: 'clearAll' }, (response) => {
        clearBtn.disabled = false;
        clearBtn.textContent = 'Clear All Now';
        if (chrome.runtime.lastError || !response || response.error) {
          showStatus(response && response.error ? response.error : 'Error connecting...', true);
        } else {
          const r = response.result;
          showStatus(`Removed ${r.tabs} tabs, ${r.history} history, ${r.downloads} downloads.`);
          getSettings({ stats: null, lastRun: null }).then((d) => renderStats(d.stats, d.lastRun));
        }
      });
    });
  });

  statusClose.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(statusTimeout);
    statusDiv.classList.remove('show');
  });
});
