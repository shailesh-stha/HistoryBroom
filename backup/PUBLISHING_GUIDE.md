# Publishing HistoryBroom to the Chrome Web Store

Step-by-step, based on the current [Chrome for Developers documentation](https://developer.chrome.com/docs/webstore) and [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) (checked July 2026). Follow in order - each step assumes the ones before it are done.

---

## 0. What you already have

The root of this project (everything **outside** `_backup/`) is the extension package:

```
manifest.json
background.js
matching.js
popup.html
popup.js
icon16.png
icon48.png
icon128.png
README.md      (harmless if zipped - not referenced by manifest.json, Chrome ignores it)
PRIVACY.md      (needs to be hosted at a public URL - see Step 2)
```

Current version: **1.0.0**. Name: **HistoryBroom**.

---

## 1. Register as a Chrome Web Store developer

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account you want to publish under. Use one you check regularly - Google sends review outcomes and policy notices here, and the account can't be changed later without re-registering.
3. Accept the **Developer Agreement**.
4. Pay the **one-time $5 USD registration fee** (per account, not per extension - once paid, you can publish up to 20 extensions on this account). It is non-refundable.
5. Confirm your **developer email** - this is permanent for the account.

Source: [developer.chrome.com/docs/webstore/register](https://developer.chrome.com/docs/webstore/register)

---

## 2. Host the privacy policy publicly

HistoryBroom requests `history`, `downloads`, `tabs`, and `browsingData` - all of which touch user data - so a published, publicly reachable privacy policy is **mandatory** (Chrome Web Store User Data Privacy Policy).

`PRIVACY.md` (project root) already contains the policy text. You just need it at a public HTTPS URL that doesn't require login. Pick one:

- **GitHub Pages** (recommended, free): push this repo (or just `PRIVACY.md`) to a public GitHub repo, enable Pages in *Settings → Pages*, and use the resulting `https://<you>.github.io/<repo>/PRIVACY.html` (or `.md` - GitHub Pages serves both, but rename to `.html` or use a Pages theme for cleaner rendering).
- **GitHub Gist**: paste the contents of `PRIVACY.md` into a public gist at [gist.github.com](https://gist.github.com) and copy its URL.
- Any static host you already use (personal site, Cloudflare Pages, Vercel, Netlify, a public Google Site).

Keep this URL - you'll paste it into the dashboard in Step 5.

---

## 3. Prepare listing assets

### Icon
Already done - `icon128.png` in the project root doubles as both the extension icon and the Store listing icon. No action needed.

### Screenshots (required: 1-5 images)
Must show the **actual extension UI**, not marketing art - Chrome Web Store policy explicitly requires screenshots to represent real product behavior.

Accepted sizes: **1280×800** or **640×400** (pick one size and stay consistent across all screenshots you upload).

How to capture them:
1. Load the unpacked extension (`chrome://extensions` → Developer mode → Load unpacked → this folder).
2. Click the toolbar icon to open the popup.
3. Populate a couple of keywords with different match modes, expand **Automation & Settings** so it's visible, and trigger a **Preview** so the status bar shows a real result - this makes for a much more compelling screenshot than an empty list.
4. Screenshot the popup (Windows: `Win+Shift+S`, snip just the popup window).
5. Resize/pad to exactly 1280×800 or 640×400 in any image editor (Paint, GIMP, Photopea). Padding with solid background color around the popup is fine and common.
6. Repeat for 2-4 more states: the Keywords panel with several match modes, the Exceptions panel, the Settings/Automation panel, and a "Removed X items" success state.

### Promotional images (optional, but improves placement in search/collections)
- **Small promo tile**: 440×280 PNG
- **Marquee**: 1400×560 PNG

Not required to publish - skip for v1.0.0 if you want to launch faster, add later from the dashboard.

---

## 4. Package the extension

Zip the **contents** of the project root (not the folder itself - the ZIP's top level must contain `manifest.json` directly, not a subfolder). Exclude `_backup/`.

PowerShell, from the project root:

```powershell
Compress-Archive -Path manifest.json,background.js,matching.js,popup.html,popup.js,icon16.png,icon48.png,icon128.png -DestinationPath historybroom-1.0.0.zip
```

Verify: unzip it somewhere and confirm `manifest.json` is at the top level, not inside a nested folder. This is the single most common upload rejection cause.

---

## 5. Create the listing in the dashboard

1. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), click **Add new item**.
2. Upload `historybroom-1.0.0.zip`. Chrome parses `manifest.json` and pre-fills the name/version/description.
3. Work through each tab:

### Package tab
Read-only summary of what was parsed from the zip. Confirm name is **HistoryBroom**, version **1.0.0**.

### Store listing tab
- **Detailed description**: paste the "Detailed description" block from the **Store listing copy** section of `README.md`.
- **Category**: Productivity (or Tools).
- **Language**: English.
- **Screenshots**: upload the images from Step 3.
- **Icon**: should already be pulled from the manifest; confirm it's `icon128.png`.
- **Official URL / homepage** (optional): leave blank or point to your GitHub repo if public.

### Privacy tab - the part most submissions get rejected on
- **Single purpose description**: one or two plain sentences. Suggested text:
  > HistoryBroom lets users define keywords and automatically removes browser history entries, downloads, and open tabs that match those keywords, to protect their privacy.
- **Permission justifications** - Chrome requires a plain-language reason for *every* permission in `manifest.json`. Use these:

  | Permission | Justification text to paste |
  |---|---|
  | `history` | "Required to search browsing history for user-defined keywords and delete matching entries." |
  | `downloads` | "Required to search the downloads list for user-defined keywords and erase matching download records." |
  | `tabs` | "Required to read tab titles/URLs to find and close tabs matching user-defined keywords." |
  | `storage` | "Required to save the user's keyword list, exceptions, and settings locally on their device." |
  | `alarms` | "Required to run the optional periodic auto-clean on the interval the user configures." |
  | `idle` | "Required for the optional 'clean when idle' feature, which triggers a clean after user-configured inactivity." |
  | `browsingData` | "Required for the optional Deep Clean and per-site data cleanup features, which the user must explicitly enable." |
  | `notifications` | "Required to show a system notification confirming an automatic clean completed." |

- **Data usage disclosure**: Chrome will ask what categories of data the extension "collects." HistoryBroom **reads** browsing history/tabs/downloads locally to act on them but never collects, stores remotely, sells, or transmits any of it anywhere. When the form asks you to certify, select **"No, I do not collect or transmit user data off-device"** if that option is offered, or explicitly list the categories it touches (browsing history, personally identifiable info is *not* collected) and confirm **"Not sold to third parties"** / **"Not used for purposes unrelated to the item's single purpose"** / **"Not used for creditworthiness or lending purposes."** This matches the [Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use) requirements.
- **Privacy policy URL**: paste the public URL from Step 2.
- **Remote code**: HistoryBroom bundles all its code and fetches nothing at runtime - answer **"No, I do not use remote code"** (Manifest V3 also enforces this).

### Distribution tab
- **Visibility**: Public (or "Unlisted" if you only want people with the direct link to find it while you test).
- **Pricing**: Free.
- **Distribution countries**: All regions, unless you have a reason to restrict.

### Test instructions tab (optional)
Only needed if a reviewer would hit a login wall or unclear flow. HistoryBroom needs none of that, but it's worth leaving a one-line note since the PIN-lock feature could otherwise confuse a reviewer:

> No login required. Optional: under Automation & Settings you can set a PIN to lock the popup - leave it blank to test all features without one.

---

## 6. Submit for review

1. Click **Submit for review**.
2. Choose:
   - **Publish automatically after approval** - goes live the moment Google approves it, or
   - **Publish manually** - approved items stay hidden until you click Publish yourself (you have up to 30 days to do so before needing to resubmit).
3. Review timelines vary - simple extensions with narrow, well-justified permissions (like this one) are typically reviewed within a few days; it can take longer if permissions look broad or the automated policy checks flag something. `browsingData` and `history` are sensitive enough that a first submission is more likely to get a manual review pass - this is normal, not a rejection.

---

## 7. If it gets rejected

Rejection emails cite a specific policy section. The two most likely for this kind of extension:
- **Insufficient permission justification** - tighten the wording in the Privacy tab table above to be even more literal about what triggers each permission's use.
- **Screenshots don't represent the extension** - re-check Step 3; screenshots must be actual captured UI, not illustrations.

Fix the flagged item, re-zip if code changed, upload the new package (bump the `version` in `manifest.json` first if you already published once), and resubmit - no need to re-register or re-pay the fee.

---

## 8. After it's live

- The listing appears at `https://chromewebstore.google.com/detail/<generated-id>`. Bookmark it.
- To ship an update: bump `"version"` in `manifest.json` (Chrome rejects a re-upload with an unchanged or lower version number), re-zip, upload as a new package version in the same dashboard item, resubmit. Updates go through review again but are usually faster than the first submission.
- Monitor the dashboard's **Analytics** tab for install counts and the **Support** tab for user feedback/ratings.
- Re-read the [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) periodically - policy violations found *after* publishing (not just at submission) can get an extension delisted.

---

## Quick checklist

- [ ] Developer account registered, $5 fee paid
- [ ] `PRIVACY.md` hosted at a public HTTPS URL
- [ ] 1-5 real UI screenshots captured (1280×800 or 640×400)
- [ ] `manifest.json` version bumped appropriately (starts at 1.0.0)
- [ ] Zipped with `manifest.json` at the zip's top level, `_backup/` excluded
- [ ] Store listing description pasted from `README.md`
- [ ] All 8 permissions justified in the Privacy tab
- [ ] Data usage / Limited Use certification completed
- [ ] Privacy policy URL pasted
- [ ] Distribution visibility & pricing set
- [ ] Submitted for review
