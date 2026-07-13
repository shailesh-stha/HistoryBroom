# Chrome Web Store Must-Have Compliance Checklist — History Broom

Compiled from the current [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [MV3 Requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements), [Quality Guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq), and the [July 2026 policy update](https://developer.chrome.com/blog/cws-policy-updates-2026) (enforcement starts **August 1, 2026**). Checked against this repo's actual `manifest.json`, `background.js`, `popup.js`, `popup.html` on 2026-07-09.

This is the *store-policy compliance* checklist. For the step-by-step submission process (screenshots, dashboard tabs, packaging), see `PUBLISHING_GUIDE.md` in this folder — don't duplicate that here.

---

## A. Manifest V3 technical requirements

- [x] **Manifest V3 only** — `manifest.json` declares `"manifest_version": 3`. (MV2 is no longer accepted.)
- [x] **No remote code** — no `<script src="http://...">`, no `eval()`, no `new Function()` anywhere in `background.js`/`popup.js` (verified by grep). `popup.html` loads only the local `popup.js`.
- [x] **Default CSP satisfied** — no inline `onclick=`/inline `<script>` in `popup.html`; nothing that would violate the enforced `script-src 'self'` baseline.
- [x] **Code is readable, not obfuscated** — source is plain, unminified JS. (Minification alone is fine if you ever ship a bundler build; obfuscation is not.)
- [x] **Full functionality discernible from submitted code** — no hidden/dynamically-constructed logic; everything ships in the package.

## B. Permissions — narrowest necessary, all justified

Manifest currently requests: `history`, `downloads`, `storage`, `tabs`, `idle`, `browsingData`, `alarms`, `notifications`. No `host_permissions` / `<all_urls>` — good, keep it that way.

- [x] Every permission maps to a real, active feature (cross-checked against `PRIVACY.md` §4, which already has a justification per permission).
- [x] **Re-verified 2026-07-09**: grepped `background.js`/`popup.js` for every permission's API — `history` (search/deleteUrl/onVisited), `downloads` (search/erase), `tabs` (query/remove/onRemoved), `storage` (local+sync), `idle` (setDetectionInterval/onStateChanged), `browsingData` (remove), `alarms` (create/onAlarm), `notifications` (create) — all used, none dead. Nothing to remove.
- [ ] When pasting justifications into the Dashboard's Privacy tab, keep the wording *literal* (what triggers the permission, not just what it's "for") — text is already drafted in `PUBLISHING_GUIDE.md` §5, just paste it in at submission time.

## C. Privacy Policy & data disclosure

- [x] `PRIVACY.md` exists, has an effective date, describes what's collected/processed and why, and states no server transmission.
- [ ] **Must be hosted at a public HTTPS URL, no login required.** Checked `https://api.github.com/repos/shailesh-stha/HistoryBroom` — returns 404 unauthenticated, meaning the repo is currently **private or not yet pushed**. This can't be fixed from here: I have no GitHub credentials in this environment. **You need to**: push this repo to GitHub, set it **Public** (Settings → General → Danger Zone), then enable **Settings → Pages** (source: `main` branch, `/ (root)`) — the resulting `https://shailesh-stha.github.io/HistoryBroom/PRIVACY.md` (or `.html`, see `PUBLISHING_GUIDE.md` §2) is the URL to paste into the Dashboard.
- [ ] Privacy policy's **contact method** currently only points at the GitHub repo link, which is only reachable once the repo above is public. Your call: leave it as-is once the repo is public, or add a direct contact email to `PRIVACY.md` §6 yourself — I didn't add a personal email on your behalf since that's your decision to publish or not.
- [x] **Limited Use compliance** — no data sold, no ads, no analytics/telemetry, nothing used beyond the disclosed single purpose. Matches policy.
- [ ] **2026 update — Disclosure Requirements**: if any future version changes what data is touched or how (e.g. adding sync, adding a new permission), you must proactively disclose that change to existing users, not just update the store listing silently.

## D. Single Purpose & Minimum Functionality

- [x] Single, narrow purpose: "erase browsing history/downloads/tabs matching user keywords." No unrelated bundled features (no ad injection, no new-tab override, no unrelated toolbar).
- [x] Provides real, self-contained utility without the extension merely being a wrapper/installer for another app or website.
- [ ] If you ever add more permissions/features (e.g. cross-site data cleaning from `Recommendations.md` §3.3), re-check they still serve *this* stated purpose — don't let scope creep turn it into a multi-purpose extension, which is an automatic quality-guideline violation.

## E. Listing / metadata (quick cross-check — full steps in `PUBLISHING_GUIDE.md`)

- [ ] Description, icon, and 1–5 real-UI screenshots present in the Dashboard listing (not just in the repo).
- [ ] Listing text matches actual behavior — no claims the extension doesn't do (a top rejection cause: "misleading or unexpected behavior").
- [ ] No keyword-stuffing in the title/description.

## F. Regulated content / behavior — not applicable but confirm on every update

- [x] No gambling, regulated goods, mature content, hate speech, or AI-safety-circumvention functionality (2026 addition) — none apply to this extension.
- [x] No deceptive installation tactics, no fake system dialogs, no ads at all (extension has none).

## G. Developer account requirement

- [ ] **2-Step Verification must be enabled on the publishing Google account** — this lives in your Google Account security settings, not in this repo or any CLI I have access to here. Enable it yourself before your first submission: [myaccount.google.com/security](https://myaccount.google.com/security).

## H. Pre-submission smoke test (from `Recommendations.md`, re-checked against current code)

- [x] No `innerHTML` with user-controlled data (was flagged as an XSS risk in `Recommendations.md` #1 — verified fixed, `popup.js` builds nodes via `createElement`/`textContent`).
- [x] Notification icon path — `background.js` `notify()` correctly references `icon128.png`, which exists in the package. (The `Recommendations.md` note about a missing `icon.png` is stale/already fixed.)
- [x] Alarm minimum interval — `setupAlarm()` clamps to `Math.max(60, ...)` seconds and the `timerSecs` input has `min="60"`; both agree with each other and sit safely above Chrome's real 30-second floor. Fixed the stale "30-second" claim in `README.md`'s Known Limitations to describe the actual 60s clamp.
- [x] Broken doc link — `README.md` referenced `_backup/PUBLISHING_GUIDE.md` (with underscore); the real folder is `backup/`. Fixed both occurrences so the link and file table actually resolve.

---

## Bottom line

Everything checkable from inside this repo is now verified and, where it was actually broken, fixed (`README.md`'s dead `_backup/` links, the stale 30s-vs-60s alarm claim). Permission usage was re-audited against real API calls — nothing unused, nothing to trim. There is no code left to write for compliance; the extension's structure already satisfies MV3, single-purpose, and Limited Use requirements.

**What's left only you can do** (all outside this environment — no GitHub auth or Google account access from here):
1. Push/make the `HistoryBroom` GitHub repo **public**, then enable **GitHub Pages** so `PRIVACY.md` resolves at a public HTTPS URL — required before submission.
2. Decide whether the privacy policy's contact method stays "GitHub repo" (fine once public) or you add a direct email — your call, not mine.
3. Enable **2-Step Verification** on the Google account you'll publish under.
4. Everything in `PUBLISHING_GUIDE.md`: pay the $5 registration fee, capture real-UI screenshots, fill in the Dashboard's Store listing / Privacy / Distribution tabs, and submit.

Sources:
- [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Additional Requirements for Manifest V3](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Best Practices and Guidelines](https://developer.chrome.com/docs/webstore/program-policies/best-practices)
- [Extensions quality guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)
- [Chrome Web Store policy updates 2026](https://developer.chrome.com/blog/cws-policy-updates-2026)
- [Troubleshooting Chrome Web Store violations](https://developer.chrome.com/docs/webstore/troubleshooting)
