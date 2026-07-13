# HistoryBroom

**Sweep browsing history, downloads, and tabs clean by keyword - manually, on a timer, or the moment you go idle.**

A Chrome extension (Manifest V3) that scrubs browsing traces matching a list of keywords you define. For each keyword it:

1. **Closes open tabs** whose title or URL matches.
2. **Deletes matching history entries** (searches all history, up to 100,000 results per keyword).
3. **Erases matching download records** (the record, not the file on disk).
4. **Optionally purges site data** (cookies, cache storage, localStorage, IndexedDB, service workers) - but *only* for the sites that matched a keyword.
5. **Optionally deep-cleans** the browser: purges *all* cache and form data. Passwords are never touched.

Cleanup can run manually, on a schedule, or reactively. Everything stays local - see [PRIVACY.md](PRIVACY.md).

## Features

### Matching
- **Four match modes per keyword**: `contains` (substring), `word` (whole-word), `domain` (exact host or subdomain), and `regex`.
- **Exceptions list** - anything matching an exception (e.g. `mybank.com`) is never removed, even if a keyword matches it.

### Triggers
- **Clear All Now** - manual cleanup with a per-category result count and a busy state while it runs.
- **Preview** - dry run: shows what *would* be removed without deleting anything.
- **Real-time Scrub** - deletes a matching history entry the instant it is recorded (`history.onVisited`).
- **Clear on Tab Close** - full cleanup whenever a tab closes (re-entrancy-guarded, so the tabs the cleanup itself closes don't retrigger it).
- **Clear when Idle** - cleanup after a configurable idle period (uses `idle.setDetectionInterval`).
- **Clear Every N seconds** - periodic cleanup via the Alarms API (Chrome's floor is 30 s; the UI clamps to it). Shows an OS notification after each run.
- **Clear on Browser Start** - sweeps leftovers from the previous session.
- **Panic shortcut** - `Ctrl+Shift+.` (configurable at `chrome://extensions/shortcuts`) runs a full cleanup without opening the popup.

### Quality of life
- Toolbar **badge** shows the active keyword count.
- **Stats bar**: last clean (trigger, time, breakdown) and lifetime totals.
- **Export / Import** settings as JSON.
- Optional **PIN lock** on the popup (stored as a SHA-256 hash).
- Dark mode, keyboard-friendly (Enter adds keywords, visible focus states, ARIA labels).
- Deep Clean requires a second confirming click.

## Installation (unpacked / development)

1. Open `chrome://extensions` (or the equivalent in Edge/Brave).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the icon and click it to open the popup.

For publishing this extension to the Chrome Web Store, see **[`backup/PUBLISHING_GUIDE.md`](backup/PUBLISHING_GUIDE.md)**.

## Usage

1. Add keywords under **Keywords to Scrub**, choosing a match mode for each.
2. Optionally add **Exceptions** for sites that must never be touched.
3. Click **Preview** to see what a cleanup would remove, then **Clear All Now** - or enable automatic triggers under **Automation & Settings**.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest: permissions, icons, popup, module service worker, panic command |
| `background.js` | Service worker: collection + cleanup engine, triggers (alarm/idle/tab/startup/visit/command), badge, stats |
| `matching.js` | Pure keyword/exception matching logic |
| `popup.html` / `popup.js` | Popup UI and logic: keywords, exceptions, settings, PIN gate, export/import, preview/clear |
| `icon16/48/128.png` | Extension icons |
| `PRIVACY.md` | Privacy policy (all local, no network) - must be hosted at a public URL for the Web Store listing |
| `backup/` | Dev tooling, planning notes, and the store publishing guide - not part of the packaged extension |

## Permissions

| Permission | Why |
|---|---|
| `history` | Search/delete matching history entries; real-time scrub |
| `downloads` | Search and erase matching download records |
| `tabs` | Find and close matching tabs |
| `storage` | Persist keywords, exceptions, settings, stats, UI state |
| `alarms` | Periodic cleanup timer |
| `idle` | Idle-detection trigger |
| `browsingData` | Per-site data purge and Deep Clean |
| `notifications` | Notify after automatic cleans |

## Known limitations

- **Timer floor**: Chrome enforces a 30-second minimum alarm period (Chrome 120+); this extension clamps to 60 seconds as a safety margin.
- **Deep Clean is global**: it wipes *all* cache and form data - use the keyword-scoped "Clean Site Data for Matches" option when possible.
- **Downloads**: only the browser's download *records* are erased; downloaded files remain on disk.
- **Regex keywords** can't use the browser's search prefilter, so they scan recent history (up to 100,000 entries) and are slower on huge histories.
- **PIN lock** deters shoulder-surfers only; anyone with access to the profile's extension storage can bypass it.

---

## Store listing copy

Drop these straight into the Chrome Web Store Developer Dashboard when submitting (see the publishing guide for exactly where each one goes).

**Extension name:** `HistoryBroom`

**Short description** *(≤132 characters, shown in search results)*
> Sweep browsing history, downloads & tabs clean by keyword - manually, on a timer, or the moment you go idle.

**Detailed description** *(shown on the listing page)*

> ## HistoryBroom - keyword-powered privacy, on your schedule
>
> Some browsing you don't want lingering - a gift search, a sensitive lookup, a work tab on a shared laptop. HistoryBroom watches for the words you tell it to watch for, and sweeps every trace of them: open tabs, history entries, and download records, gone in one click or automatically, on your terms.
>
> **How it works**
> Add a keyword. Pick how it should match - plain contains, whole word, exact domain, or full regex for power users. HistoryBroom then finds every tab, history entry, and download that matches, and removes it.
>
> **Clean your way**
> - **On demand** - hit Clear All Now, or Preview first to see exactly what would go.
> - **On a timer** - sweep every N seconds automatically.
> - **When you step away** - trigger a clean after the machine goes idle.
> - **The instant it happens** - real-time scrub deletes matching history the moment it's written.
> - **On tab close, on browser start, or with a panic keyboard shortcut** for the moment you need it gone *now*.
>
> **Built-in safety net**
> Exceptions keep the sites you never want touched - like your bank - permanently off-limits, even if they happen to match a keyword. Deep Clean (optional, and double-confirmed) goes further and purges cache and form data browser-wide.
>
> **Everything stays on your device**
> HistoryBroom makes zero network requests. No analytics, no telemetry, no third-party code. Your keywords, settings, and stats live only in your browser's local storage - see the full privacy policy for details.
>
> **Features**
> ✓ 4 keyword match modes (contains / word / domain / regex)
> ✓ Exceptions list - sites that are always protected
> ✓ Preview before you delete
> ✓ Timer, idle, tab-close, startup, and real-time triggers
> ✓ Panic keyboard shortcut
> ✓ Optional PIN lock on the popup
> ✓ Export / import your settings
> ✓ Dark mode, keyboard accessible
> ✓ 100% local - no accounts, no servers, no tracking

**Category:** Productivity (or Tools, depending on availability in your locale)

**Language:** English

