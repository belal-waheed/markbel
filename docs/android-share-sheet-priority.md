# Android 12 Share Sheet: Making Markbel #1 Without Clicking "More"

This guide outlines two proven ways to make Markbel appear in **Slot #1 (top-left)** of your Android 12 Share Sheet for instant 1-tap link saving.

---

## ⚡ Method 1: Android 12 Native Share Pinning (5 Seconds — No Coding Needed)

Android 12 includes a built-in OS capability to lock your favorite share destination permanently to **Position #1** in the top row across all apps (Chrome, YouTube, Twitter/X, Reddit, TikTok, etc.).

### How to Pin Markbel to Slot #1:
1. **Install Markbel PWA:** Open `https://mark.obel.workers.dev` in Chrome / Edge on your Android phone → Tap the 3 dots menu → Tap **"Install app"** (or "Add to Home screen").
2. Open any app on your phone (e.g., YouTube or Chrome).
3. Tap **Share** on any link or video.
4. In the Android Share Sheet that slides up, scroll to find **Markbel** (tap "More" or swipe right in the apps row once).
5. **Press and hold (Long-press)** the Markbel icon for 1 second.
6. Tap **"Pin Markbel"** (or the 📌 icon).

🎉 **Result:** Markbel is now locked to **Slot #1 (Top-Left)** of your Android Share Sheet. Every time you tap "Share" on any link in any app, Markbel appears right under your finger with zero scrolling or "More" clicking!

---

## 📱 Method 2: Trusted Web Activity (TWA) Native Android Package

If you want Markbel packaged as a standalone Android `.apk` installed directly or via Google Play, you can build a native Trusted Web Activity (TWA) using Google's **Bubblewrap CLI**.

### 1. TWA Manifest Configuration (`twa-manifest.json`)
The repository includes `twa-manifest.json` configured for `mark.obel.workers.dev`:
```json
{
  "packageId": "com.markbel.vault",
  "host": "mark.obel.workers.dev",
  "name": "Markbel",
  "launcherName": "Markbel",
  "themeColor": "#090d16",
  "navigationColor": "#090d16",
  "backgroundColor": "#090d16",
  "enableNotifications": true,
  "startUrl": "/",
  "iconUrl": "https://mark.obel.workers.dev/pwa-512x512.png",
  "maskableIconUrl": "https://mark.obel.workers.dev/pwa-512x512.png",
  "appVersionCode": 2,
  "appVersionName": "2.1.0",
  "shareTarget": {
    "action": "/share",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

### 2. Building the APK with Bubblewrap:
```bash
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Initialize & Build Android Package
bubblewrap init --manifest=https://mark.obel.workers.dev/manifest.webmanifest
bubblewrap build
```

This generates `app-release-signed.apk` with an Android `android.intent.action.SEND` intent filter registered natively in the OS.
