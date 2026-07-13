# Recommendations — Pro History Cleaner

Based on a review of the current code (`manifest.json`, `background.js`, `popup.js`, `popup.html`) and a comparison with established extensions in this space ([Click&Clean](https://chromewebstore.google.com/detail/click-and-clean/mgngmngjioknlgjjaiiamcdbahombpfb), [Auto History Wipe](https://autohistorywipe.com/), History AutoDelete) and current [Chrome MV3 platform docs](https://developer.chrome.com/docs/extensions/reference/api/alarms).

---

## 1. Code Updates & Improvements

1. **Fix the XSS in the keyword list (`popup.js` `renderList`).** Keywords are injected via `li.innerHTML = `<span>${word}</span>...``. A keyword like `<img src=x onerror=...>` executes in the popup. Build the `<li>` with `document.createElement` / `textContent`. This is the one genuine security bug in the codebase.

2. **Guard against the tab-close re-entrancy loop.** `performFullCleanup` closes tabs → each close fires `chrome.tabs.onRemoved` → which (with "Clear on Tab Close" enabled) starts another full cleanup per closed tab. With Deep Clean on, one manual clear can purge the cache N+1 times. Add a simple `isCleaning` lock around `performFullCleanup`.

3. **Use `chrome.downloads.erase({ query: [...] })` directly.** It accepts the same query object as `search`, so the search-then-erase-each loop in `background.js` collapses to one API call per keyword (erase returns the erased IDs for counting).

4. **Fix the broken idle detection.** `chrome.idle.onStateChanged` fires at the *default* 60-second detection interval; the follow-up `queryState(threshold)` re-check is a workaround that still fires early/never as intended. The correct API is `chrome.idle.setDetectionInterval(minutes * 60)` set once when the setting changes — then the listener alone is sufficient.

5. **Add error handling around each cleanup phase.** There is no `try/catch` anywhere. One rejected call (e.g. `tabs.remove` on a tab that closed mid-scan, or a revoked permission) aborts the entire cleanup silently, and `sendResponse` is never called — the popup just shows nothing. Wrap the tabs / history / downloads phases independently and add a `.catch` on the message-handler path so the popup can show an error.

6. **Align the timer with the real Alarms API floor and validate input.** Since Chrome 120 the minimum alarm period is **30 seconds** (`periodInMinutes: 0.5`); smaller values are not honored and log a warning ([docs](https://developer.chrome.com/docs/extensions/reference/api/alarms)). The UI currently allows `min="10"`. Clamp to ≥30 s in both the input and `setupAlarm`, and surface the clamp to the user instead of silently under-delivering.

7. **Ship the missing `icon.png` and declare `icons` in the manifest.** `chrome.notifications.create` references `icon.png`, which doesn't exist — timed-clean notifications fail silently. Add a real icon set (16/48/128) and an `action.default_icon`; store review also requires icons.

8. **Parallelize deletions.** History entries and downloads are deleted one-by-one with `await` in a loop. `Promise.all(historyResults.map(i => chrome.history.deleteUrl({url: i.url})))` makes large scrubs (the code allows 100,000 results per keyword) dramatically faster.

9. **Normalize and validate stored data.** Keywords are stored as-typed but matched lowercased — store them trimmed + lowercased once. `parseInt(e.target.value)` can store `NaN` for `idleMinutes`/`timerSeconds`; validate with a fallback before saving. Centralize the scattered `|| defaults` (60, 5, false…) into one `DEFAULTS` object used by both popup and background.

10. **Modernize the async style and fix the count.** `chrome.browsingData.remove` is promise-based in MV3 — drop the manual `new Promise` wrapper. And `totalRemoved` double-counts URLs matching multiple keywords and mixes tabs+history+downloads into one number; return a `{tabs, history, downloads}` breakdown of *unique* items instead.

---

## 2. UX / UI Polish

1. **Add keyword on Enter.** Typing a word and pressing Enter currently does nothing; requiring a mouse click on "Add" for every keyword is the popup's biggest friction point.

2. **Give feedback on duplicate/empty keyword adds.** `addBtn` silently ignores duplicates and blanks — flash the existing status bar ("Already in list") so the user isn't left wondering if the click registered.

3. **Preview before destroying.** History deletion is irreversible. Industry peers show what will be cleared; a "Found 143 history items, 2 tabs, 1 download" dry-run count next to (or before) **Clear All Now** turns a scary button into an informed one. At minimum, confirm before a Deep Clean.

4. **Show a busy state on "Clear All Now".** A big scrub can take seconds; the button stays clickable and mute. Disable it and show "Cleaning…" until the response arrives (also prevents double-fires).

5. **Make the Deep Clean scope unmistakable.** The hint says "Purges Cache & Form Data" but not that it's *global and since the beginning of time*, unrelated to keywords. Re-label ("Also wipe ALL browser cache & form data") and style it as a warning, not a regular row.

6. **Show "last cleaned" status.** Persist a timestamp + result after each run (manual or automatic) and display it in the popup — right now automatic cleans are invisible unless the OS notification happens to work.

7. **Use the toolbar badge.** `chrome.action.setBadgeText` showing the keyword count (or a ✓ after a clean) gives at-a-glance state without opening the popup — standard practice among cleaner extensions.

8. **Empty-state for the keyword list.** A fresh install shows a bare bordered box. One line — "No keywords yet. Add one above." — orients new users.

9. **Accessibility pass.** The ✕ delete buttons have no accessible name (`aria-label="Remove <word>"`), `summary` has `outline: none` which kills keyboard focus visibility, and number inputs lack associated labels. Small fixes, real gains.

10. **Dark mode.** The popup is hard-coded light. A `@media (prefers-color-scheme: dark)` block over the existing few colors is cheap and expected in 2026.

---

## 3. Future Development Ideas

1. **Match modes per keyword.** Plain substring over-matches badly (`art` hits `smartphone.com`). Offer whole-word, domain-only, and regex modes — the single biggest functional gap versus mature cleaners.

2. **Real-time scrubbing via `chrome.history.onVisited`.** Instead of (or alongside) periodic sweeps, delete a matching entry the moment it's recorded — the History AutoDelete model. Eliminates the window where sensitive entries sit in history between timer ticks.

3. **Keyword-scoped site-data cleaning.** Deep Clean is all-or-nothing. `chrome.browsingData.remove` accepts an `origins` list — derive origins from matched history/tabs and purge cookies, cache, localStorage, IndexedDB *only for matching sites*. This would leapfrog most competitors, which are also all-or-nothing.

4. **Panic-button keyboard shortcut.** A `chrome.commands` binding (Click&Clean uses Ctrl+Shift+E) that triggers a full cleanup instantly without opening the popup — the core "someone walked in" use case for this category.

5. **Clean-on-exit and scheduled windows.** Auto History Wipe's headline feature is cleaning when the browser closes/starts; add an `onStartup` sweep ("clean anything from last session") and optionally time-of-day schedules ("every day at 18:00").

6. **Export/import and sync of keyword lists.** JSON export/import for backup, plus optional `chrome.storage.sync` so keywords follow the user across machines (with a caveat in the UI that synced keywords are visible to anyone with account access).

7. **Whitelist / exceptions.** "Match `bank` but never touch `mybank.com`." An exception list checked before deletion prevents the false-positive damage that substring matching invites.

8. **Stats dashboard.** A lightweight options page charting items cleaned over time and per keyword — makes the automatic modes tangible and helps users tune keyword lists.

9. **Cross-browser port.** The code is already near-standard WebExtensions; with the `browser.*` namespace polyfill it could ship on Firefox and Edge stores for little effort, tripling the addressable audience.

10. **Privacy hardening & store readiness.** A published privacy policy ("all local, nothing leaves the browser"), an optional PIN to open the popup (this category's users specifically fear shoulder-surfers), and trimming any permission not strictly needed at install time (e.g. request `browsingData` optionally, only when Deep Clean is first enabled) — all three are what Chrome Web Store review and privacy-conscious users now expect.

---

*Sources: [chrome.alarms API reference](https://developer.chrome.com/docs/extensions/reference/api/alarms), [Chrome 120 extensions release notes](https://developer.chrome.com/blog/chrome-120-beta-whats-new-for-extensions), [Click&Clean](https://chromewebstore.google.com/detail/click-and-clean/mgngmngjioknlgjjaiiamcdbahombpfb), [Auto History Wipe](https://autohistorywipe.com/), [Click and Clean overview](https://browsernative.com/click-and-clean-chrome-extension/).*
