# Markbel — Complete Codebase Documentation and Run Guide

Markbel is an understated, high-performance, and beautifully styled **Cyberpunk Neon-on-Dark** bookmarks app designed as a companion to the Obel productivity suite. It consists of an Express REST API backend, a Vite + React + TypeScript frontend, an Expo React Native mobile wrapper, and an Electron desktop companion.

---

## 1. Directory Structure and Architectural Overview

The repository is organized into three major components:

```
markbel/
├── markbel-vercel/         # Production and Deployment Monorepo
│   ├── backend/            # Express REST API (TypeScript)
│   │   ├── src/
│   │   │   ├── db.ts       # MongoDB connection helper
│   │   │   ├── models/     # Schemas (User.ts, Bookmark.ts)
│   │   │   ├── server.ts   # Core Express server, routes, SSE, and scraper
│   │   │   └── middleware/ # Authentication middleware (JWT)
│   │   └── package.json
│   │
│   └── frontend/           # Vite + React + TypeScript SPA
│       ├── src/
│       │   ├── lib/        # Auth context provider & Axios/Fetch API client
│       │   ├── views/      # LoginPage, BookmarksPage, ShareTargetPage
│       │   ├── components/ # Common UI components
│       │   └── index.css   # Cyberpunk design system stylesheet
│       └── package.json
│
├── desktop/                # Electron Desktop Wrapper
│   ├── main.js             # Electron main process (tray, startup settings, clipboard)
│   ├── preload.js          # Electron secure renderer bridge
│   ├── offline.html        # Fallback offline UI dashboard
│   └── package.json
│
└── mobile/                 # Expo React Native App
    ├── App.tsx             # WebView container, share target listener, back handler
    ├── app.json            # Expo application descriptors & sharing intents configuration
    └── package.json
```

---

## 2. Core Functional Design and Data Flows

### A. Real-Time Syncing (Server-Sent Events)
Markbel uses a lightweight, secure Server-Sent Events (SSE) stream to instantly update all active clients without manual refreshing.
1. **Connection**: When the frontend mounts, it opens an EventSource connection to `/api/bookmarks/events?token=<JWT>`.
2. **Server Broadcast**: The backend keeps an active array of connections associated with each user. Whenever a user creates, renames, deletes, or updates a bookmark, the backend writes a notice to their SSE clients.
3. **Scraper Sync**: When metadata scraping resolves in the background, the server updates MongoDB and automatically pushes a reload event, refreshing all screens instantly.

### B. Asynchronous Metadata Scraping
1. **Submission**: The user submits a URL in the UI (or shares it from a mobile browser).
2. **Immediate Reply**: The server immediately creates a placeholder bookmark using the URL domain as a temporary title, returns a successful `201 Created` status, and closes the modal in the UI.
3. **Background Scrape**: The server launches an asynchronous scraper. It fetches the page HTML, parses OpenGraph tags (`og:title`, `og:image`, `og:description`), scrapes custom YouTube thumbnails if the URL is a video, updates the DB, and fires an SSE broadcast to trigger client-side updates.

### C. System Tray & Close Behavior (Desktop)
- Clicking the window close button (`X`) hides the Electron window (`event.preventDefault(); mainWindow.hide()`) to let clipboard monitoring run uninterrupted.
- The app registers a system tray icon with a custom menu containing options to **Show App**, **Sync Now**, toggle **Run at Startup**, and a dedicated **Exit** action to fully terminate the process.

### D. Offline Sync and Share Sheet (Mobile)
- **Shared Sheets**: When you share a link from a mobile browser, it is caught by the native sharing hooks and routed to `/share-target` in the WebView.
- **Offline Fallback**: If the mobile device is offline, the app queues the link inside `AsyncStorage` and displays a local Cyberpunk HUD.
- **Sync Routine**: When connectivity is restored, the queue is automatically synchronized with the database in the background.

---

## 3. Configuration and Environment Setup

### A. Web Backend (`markbel-vercel/backend/.env`)
Create a `.env` file inside `markbel-vercel/backend/` with the following variables:
```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/markbel
JWT_SECRET=your_super_secret_jwt_key
```

### B. Web Frontend (`markbel-vercel/frontend/vite.config.ts`)
The Vite config is pre-configured to proxy `/api/*` requests in development to proxy to port `3001` (Express API) to prevent CORS issues.

---

## 4. Setup and Run Instructions

Make sure you have [Node.js](https://nodejs.org/) (v18 or higher) and [MongoDB](https://www.mongodb.com/) running locally.

### A. Running the Web App (Monorepo Backend + Frontend)

1. Open your terminal at the root of `markbel-vercel/` (or run from the parent monorepo folder):
   ```bash
   cd markbel-vercel
   ```
2. Install dependencies for the backend and frontend:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Start the backend server in development mode:
   ```bash
   cd ../backend
   npm run dev
   # API runs at http://localhost:3001
   ```
4. Start the Vite React frontend in a new terminal window:
   ```bash
   cd ../frontend
   npm run dev
   # Web app runs at http://localhost:5173
   ```

---

### B. Running the Desktop App (Electron)

The desktop app loads the deployed production Vercel application by default. In development, you can change the target URL in `desktop/main.js` to `http://localhost:5173`.

1. Navigate to the `desktop` directory:
   ```bash
   cd desktop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the desktop app:
   ```bash
   npm start
   ```
   * *System Tray*: A Markbel logo will appear in your system tray. 
   * *Startup*: Check "Run at Startup" in the tray menu to automatically register the application to your OS startup apps list.

---

### C. Running the Mobile App (Expo Wrapper)

1. Navigate to the `mobile` directory:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start Expo:
   ```bash
   npx expo start
   ```
4. Scan the QR code using the **Expo Go** application on your physical iOS/Android device or launch it in an emulator/simulator.

---

## 5. Building Standalone/Production Packages

### A. Mobile Standalone Build (Android .apk Preview)
To generate a standalone `.apk` for Android using Expo Application Services (EAS):
1. **Prerequisite**: Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. **Login**: Authenticate with your Expo developer account:
   ```bash
   eas login
   ```
3. **Configure**: If running for the first time, initialize the project:
   ```bash
   cd mobile
   eas project:init
   ```
4. **Build Preview**: Run the preview builder profile (configured in [eas.json](file:///d:/dev/projects/bel_projects/markbel/mobile/eas.json) to output an `.apk` file instead of an App Bundle):
   ```bash
   eas build --platform android --profile preview
   ```
   *EAS will run a remote build, package the Android artifact, and output a QR code / download link to install the `.apk` directly onto a device.*

### B. Desktop Standalone Installer (Windows .exe)
To compile, package, and generate a Windows installer package (`.exe`) for the Electron app:
1. Navigate to the `desktop` directory:
   ```bash
   cd desktop
   ```
2. Build the distribution bundle using electron-builder:
   ```bash
   npm run dist
   ```
   *This packages the JS/CSS files and outputs the executable setup installer inside the `desktop/dist/` directory.*

