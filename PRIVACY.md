# Privacy Policy for History Broom

**Effective Date:** July 7, 2026

History Broom ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains our data practices for the History Broom Chrome Extension. 

### 1. Zero Data Collection & Off-Device Transmission
History Broom is built with a strict **local-only** architecture. 
* **No Server Communication:** The extension does not communicate with any external servers.
* **No Analytics or Tracking:** We do not collect, monitor, or transmit any analytics, telemetry, crash logs, or usage statistics off your device.
* **No Third-Party SDKs:** The extension contains zero third-party tracking scripts, advertising SDKs, or analytics APIs.

### 2. Information We Process and Store (Locally)
To perform its core functions, the extension accesses and processes certain browsing data locally on your device. This data is **never** sent to us or any third party:

* **Keywords & Exceptions:** The terms you define for scrubbing are stored locally on your device to run the matching logic.
* **Browsing History & Downloads:** The extension reads your local browsing history and download history to find and erase records matching your keywords.
* **Active Tabs:** The extension reads tab titles and URLs to find and close tabs matching your keywords.
* **Lock PIN:** If you enable the lock screen feature, a SHA-256 hash of your PIN is stored locally to restrict access to the popup UI.

### 3. Local Data Storage & Sync
* **Local Storage:** All configuration settings, lists, and statistics are stored locally on your device using Chrome's sandboxed storage (`chrome.storage.local`).
* **Optional Cloud Sync:** If you explicitly enable the "Sync Settings" toggle, your keywords, exceptions, and configuration will be synced across your personal Chrome profiles using Google’s secure native synchronization (`chrome.storage.sync`). None of this data is accessible to us.
* **Data Retention:** All settings and configurations are deleted instantly and completely when you uninstall the extension.

### 4. Permission Justifications
In accordance with the Chrome Web Store Developer Policies, here is why each permission is required:
* `history`: To search for and delete matching URLs from your browser history.
* `downloads`: To search for and erase matching download records.
* `tabs`: To read open tab titles and URLs, and close matching tabs.
* `storage`: To save your settings, keywords, exceptions, and statistics locally.
* `alarms`: To trigger the optional recurring timer cleanup.
* `idle`: To trigger the optional cleanup when your device goes idle.
* `browsingData`: To run the optional Deep Clean (wiping cache and autofill forms) and clear site data.
* `notifications`: To display system notifications confirming that automated cleanups have finished.

### 5. Compliance with Chrome Web Store Limited Use Policy
History Broom complies fully with the Google Chrome Web Store User Data Policy, including the **Limited Use** requirements:
* We only use permissions and access to data to provide and improve the single, core user-facing disclosure purpose of the extension (scrubbing data by keyword).
* We **never** sell, rent, or lease any user data to third parties.
* We **never** use or transfer user data for personalized advertising, credit checks, lending, or profiling.
* Human review of user data is impossible because no user data is collected or transmitted.

### 6. Contact Information
If you have any questions or feedback regarding this Privacy Policy, please contact the developer via the official GitHub repository support channel:
[https://github.com/shailesh-stha/HistoryBroom](https://github.com/shailesh-stha/HistoryBroom)
