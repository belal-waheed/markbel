# Markbel Extension Setup & Usage Guide

Markbel's extension is built primarily for Chromium-based browsers (Chrome, Edge, Brave, Vivaldi, Arc).

## Installation

### Method 1: Edge Add-ons Store (Recommended)
For the easiest setup, you can install the extension directly from the Microsoft Edge Add-ons store (which works in Chrome, Brave, and other Chromium browsers).
[**Install from Microsoft Edge Add-ons**](https://microsoftedge.microsoft.com/addons/detail/markbel-%E2%80%94-quick-bookmarks/molmflphbifkekgnobnflblphdefpjfc)

### Method 2: Pre-Built ZIP Release
1. Download the latest `markbel-extension.zip` from the [GitHub Releases](https://github.com/belal-waheed/markbel/releases/latest) page.
2. Unzip the file to a permanent folder on your computer.
3. Open your browser's extensions page (`chrome://extensions/` or `edge://extensions/`).
4. Enable **Developer Mode**.
5. Click **Load unpacked** and select the unzipped folder.

### Method 3: Build from Source
1. Clone the repository and install dependencies.
2. Run `npm run build:extension`.
3. Load the resulting `dist-extension` folder as an unpacked extension (same as Method 2).

---

### Method 4: Mozilla Firefox & Firefox Developer Edition
1. Download `markbel-firefox-extension.zip` from GitHub Releases (or build with `npm run extension:zip:firefox`).
2. Unzip into a permanent folder on your computer.
3. Open `about:debugging#/runtime/this-firefox` in Firefox or Firefox Developer Edition.
4. Click **Load Temporary Add-on...** and select `manifest.json` from the extracted folder.
5. *(Firefox Developer Edition only)* For permanent installation without signature enforcement, open `about:config` and set `xpinstall.signatures.required` to `false`.

---

## Initial Setup & Authentication
Before you can save bookmarks, you must link the extension to your Markbel vault:
1. Pin the extension to your toolbar.
2. Click the Markbel icon to open the popup HUD.
3. You will be prompted to log in with your Markbel email and password.
4. Once authenticated, the extension will securely store your token and enable background delta-sync.

---

## Power User Features

### Global Keyboard Shortcuts
You can capture bookmarks without using your mouse:
- **`Alt + Shift + S`**: Instantly saves the current active tab in the background without opening any UI. A small green badge will indicate success.
- **`Alt + B`**: Opens the Markbel popup HUD so you can edit the title, description, or add it to a specific Group before saving.

### Context Menus
Right-click anywhere on a webpage to reveal Markbel options:
- **Save Page to Markbel**: Saves the current page.
- **Save Link to Markbel**: Right-click on any hyperlink to save the destination URL without opening it.
- **Save Selection to Markbel**: Highlight text, right-click, and save. The highlighted text will be automatically added as the bookmark's description/notes.

---

## Configuration (Self-Hosting)
By default, the extension connects to the production Cloudflare Workers backend (`https://mark.obel.workers.dev/api`).

If you are running Markbel locally or self-hosting on your own Cloudflare D1 instance:
1. Right-click the Markbel extension icon and select **Options**.
2. Enter your custom API Base URL (e.g., `http://localhost:8787/api`).
3. Click **Save Settings**.

---

## Platform Support
- **Chromium Browsers**: 100% native support (Microsoft Edge, Google Chrome, Brave, Arc, Opera, Vivaldi).
- **Mozilla Firefox & Firefox Dev Edition**: 100% native Manifest V3 event script support with Gecko ID (`markbel-extension@obel.dev`).
- **Safari**: Requires Xcode/Mac Catalyst packaging and is not currently supported.

