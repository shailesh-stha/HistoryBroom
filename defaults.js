// Single source of truth for the storage schema and its defaults, imported by
// both background.js and popup.js so the two can't silently drift apart.

// Config keys are written to chrome.storage.sync or .local (whichever is
// active via "Enable Settings Sync"), and are what gets exported/imported.
export const CONFIG_DEFAULTS = {
  keywords: [],
  exceptions: [],
  autoTab: false,
  autoIdle: false,
  idleMinutes: 5,
  deepClean: false,
  cleanSiteData: false,
  autoTimer: false,
  timerSeconds: 60,
  realtimeClean: false,
  cleanOnStartup: false,
  batchSize: 100,
  protectPinned: true,
  protectOpenTabs: false,
  showBadge: true,
  pinHash: null
};

// Local-only keys: device state that always stays in chrome.storage.local,
// even when Enable Settings Sync is on, and is never exported/imported.
export const LOCAL_ONLY_DEFAULTS = {
  stats: null,
  lastRun: null,
  uiStateKeywords: true,
  uiStateExceptions: false,
  uiStateSettings: false,
  uiStateOverview: false,
  enableSync: false
};

export const LOCAL_ONLY_KEYS = Object.keys(LOCAL_ONLY_DEFAULTS);

// Full schema (config + local-only), used when loading everything at once.
export const DEFAULTS = { ...CONFIG_DEFAULTS, ...LOCAL_ONLY_DEFAULTS };
