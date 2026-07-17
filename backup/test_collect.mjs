// Run with: node _backup/test_collect.mjs (matching.js lives at the project root, which is the shipped extension package)
// Covers the pure decision logic pulled out of background.js's collectMatches
// so background.js itself stays a thin chrome.* I/O wrapper. These are the
// riskiest, most irreversible code paths in the extension (they decide what
// gets permanently deleted), so they're the ones most worth pinning down.
import assert from 'node:assert/strict';
import {
  selectTabsToAct,
  historyStartTime,
  filterHistoryMatches,
  filterDownloadMatches
} from '../matching.js';

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

// --- selectTabsToAct ---

const kwSecret = [{ text: 'secret', mode: 'substring' }];

{
  // Plain match, nothing protected: closed and its origin collected.
  const tabs = [{ id: 1, title: 'My Secret Page', url: 'https://a.com/secret', pinned: false }];
  const r = selectTabsToAct(tabs, kwSecret, [], true, false);
  assert.deepEqual(r.tabIds, [1]);
  assert.deepEqual(r.origins, ['https://a.com/secret']);
}

{
  // Regression test for the "protected tab still had its site data wiped"
  // bug: a matching PINNED tab with protectPinned=true must be excluded from
  // BOTH tabIds and origins, not just tabIds.
  const tabs = [{ id: 2, title: 'My Secret Bank', url: 'https://bank.com/secret', pinned: true }];
  const r = selectTabsToAct(tabs, kwSecret, [], true, false);
  assert.deepEqual(r.tabIds, []);
  assert.deepEqual(r.origins, [], 'protected tab origin must not leak into the site-data cleanup scope');
}

{
  // protectOpenTabs blocks every open tab, pinned or not.
  const tabs = [{ id: 3, title: 'Secret', url: 'https://a.com', pinned: false }];
  const r = selectTabsToAct(tabs, kwSecret, [], false, true);
  assert.deepEqual(r.tabIds, []);
  assert.deepEqual(r.origins, []);
}

{
  // Tabs without an id (e.g. devtools/prerendered) are skipped entirely.
  const tabs = [{ title: 'Secret', url: 'https://a.com', pinned: false }];
  const r = selectTabsToAct(tabs, kwSecret, [], false, false);
  assert.deepEqual(r.tabIds, []);
}

{
  // Non-matching tabs are left alone.
  const tabs = [{ id: 4, title: 'Public', url: 'https://a.com', pinned: false }];
  const r = selectTabsToAct(tabs, kwSecret, [], false, false);
  assert.deepEqual(r.tabIds, []);
}

// --- historyStartTime ---

assert.equal(historyStartTime({ range: '1h' }, now), now - 60 * 60 * 1000);
assert.equal(historyStartTime({ range: '24h' }, now), now - DAY);
assert.equal(historyStartTime({ range: '7d' }, now), now - 7 * DAY);
assert.equal(historyStartTime({ range: 'all' }, now), 0);
assert.equal(historyStartTime({ range: 'older30d' }, now), 0, 'older30d has no startTime; filtered post-fetch instead');

// --- filterHistoryMatches ---

{
  const results = [
    { title: 'Secret', url: 'https://a.com', lastVisitTime: now - 40 * DAY },
    { title: 'Secret recent', url: 'https://b.com', lastVisitTime: now - 5 * DAY },
    { title: 'Public', url: 'https://c.com', lastVisitTime: now - 40 * DAY }
  ];
  const kw = { text: 'secret', mode: 'substring', range: 'older30d' };
  const urls = filterHistoryMatches(results, kw, [], now);
  assert.deepEqual(urls, ['https://a.com'], 'older30d keeps only matches older than 30 days');
}

{
  const results = [{ title: 'Secret', url: 'https://mybank.com', lastVisitTime: now }];
  const kw = { text: 'secret', mode: 'substring', range: 'all' };
  assert.deepEqual(filterHistoryMatches(results, kw, ['mybank.com'], now), [], 'exceptions win over a keyword match');
}

{
  const results = [{ title: 'Secret', url: '', lastVisitTime: now }];
  const kw = { text: 'secret', mode: 'substring', range: 'all' };
  assert.deepEqual(filterHistoryMatches(results, kw, [], now), [], 'entries without a url are dropped');
}

// --- filterDownloadMatches ---

{
  const results = [
    { id: 1, filename: 'secret.pdf', url: 'https://a.com/secret.pdf', startTime: new Date(now - 30 * 60 * 1000).toISOString() },
    { id: 2, filename: 'secret.pdf', url: 'https://a.com/secret.pdf', startTime: new Date(now - 5 * 60 * 60 * 1000).toISOString() }
  ];
  const kw = { text: 'secret', mode: 'substring', range: '1h' };
  const matches = filterDownloadMatches(results, kw, [], now);
  assert.deepEqual(matches, [{ id: 1, url: 'https://a.com/secret.pdf' }], '1h range excludes the older download');
}

{
  const results = [{ id: 3, filename: 'secret.pdf', url: 'https://mybank.com/secret.pdf', startTime: new Date(now).toISOString() }];
  const kw = { text: 'secret', mode: 'substring', range: 'all' };
  assert.deepEqual(filterDownloadMatches(results, kw, ['mybank.com'], now), [], 'exceptions apply to downloads too');
}

console.log('All collect-logic tests passed.');
