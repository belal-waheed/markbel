# Privacy Policy for Markbel

**Last updated:** September 14, 2026

Markbel is committed to protecting your privacy. This privacy policy explains how our browser extension, mobile applications, and web services handle your data.

---

## 1. Core Principles
- **Offline-First & Local-First:** All bookmarks, tags, groups, and settings are stored locally on your device in your browser's local storage / IndexedDB.
- **Zero Third-Party Tracking:** Markbel does not run third-party trackers, analytics libraries, advertising SDKs, or sell personal data.
- **No Data Harvesting:** The Markbel browser extension only accesses URLs and page metadata when you actively choose to bookmark or save a webpage.

---

## 2. Browser Extension Permissions
The Markbel browser extension requests only the minimum permissions necessary for bookmarking:
- `activeTab`: Used solely to capture the title, URL, and page metadata of the currently active tab when you click the extension action or use the save hotkey (`Alt+Shift+M` or `Alt+Shift+S`).
- `storage`: Used to cache your authentication token and user preferences locally within your browser.
- `contextMenus`: Provides a right-click menu shortcut ("Save link to Markbel") for quickly saving links.
- `scripting`: Extracts OpenGraph meta tags and media metadata (titles, thumbnails, descriptions) directly on the client side without routing your browsing activity through external servers.
- `host_permissions` (`https://mark.obel.workers.dev/*`): Allows the extension to communicate with your Markbel Cloudflare Worker API to synchronize your saved bookmarks.

---

## 3. Cloud Sync (Optional)
- If you use Markbel in **Guest Mode**, no account is created and zero data leaves your local device.
- If you create an account to synchronize bookmarks across devices, your bookmark data (URLs, titles, notes, groups) is securely transmitted over HTTPS and stored in your private database (Cloudflare D1 SQLite) associated with your account.
- Passwords are encrypted using Web Crypto PBKDF2 with salt before storage.

---

## 4. Data Deletion
You can permanently delete any bookmark, group, or your entire account at any time through the Markbel Settings interface. Deleting data removes it from your local storage and initiates immediate synchronization to remove it from the cloud database.

---

## 5. Contact & Open Source
Markbel is open-source software licensed under the MIT License. You can inspect the source code, review network calls, or report questions and issues at:
- GitHub Repository: [https://github.com/belal-waheed/markbel](https://github.com/belal-waheed/markbel)
- Issues & Support: [https://github.com/belal-waheed/markbel/issues](https://github.com/belal-waheed/markbel/issues)
