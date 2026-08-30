# Android Share Sheet: Making Markbel #1 Without Clicking "More"

This guide outlines two proven ways to make Markbel appear in the very first slot of your Android Share Sheet.

---

## ⚡ Method 1: The Android Direct Share Pin (Fastest — 5 Seconds)

Android includes a built-in OS feature to lock your favorite share target to **Position #1** in the top row.

### How to Pin Markbel to the Front:
1. Open any browser (Chrome, Edge, Brave) or app (X/Twitter, Reddit) on your Android phone.
2. Tap **Share** on any link or article.
3. In the Share Sheet that pops up, find **Markbel** (if it's under "More", tap "More" once).
4. **Press and hold (Long-press)** the Markbel icon.
5. Tap **"Pin Markbel"** (or the 📌 icon).

🎉 **Done!** Markbel is now permanently pinned as the **very first app in your Android Share Sheet**. You will never need to click "More" again.

---

## 📱 Method 2: Trusted Web Activity (TWA) Native Android Package

If you want Markbel packaged as a standalone Android APK installed directly from Google Play or sideloaded, you can build a Trusted Web Activity (TWA) using Google's **Bubblewrap CLI**.

### 1. TWA Configuration (`twa-manifest.json`)
The repository includes `twa-manifest.json` configured with:
```json
{
  "packageId": "com.markbel.vault",
  "host": "markbel.vercel.app",
  "name": "Markbel",
  "launcherName": "Markbel",
  "themeColor": "#090d16",
  "navigationColor": "#090d16",
  "backgroundColor": "#090d16",
  "enableNotifications": true,
  "startUrl": "/",
  "iconUrl": "https://markbel.vercel.app/logo.png",
  "maskableIconUrl": "https://markbel.vercel.app/logo.png",
  "shareTarget": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
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
bubblewrap init --manifest=https://markbel.vercel.app/manifest.json
bubblewrap build
```

This generates `app-release-signed.apk` that registers directly as an Android top-level intent filter (`android.intent.action.SEND`).
