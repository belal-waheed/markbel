# Markbel Project Rules & Mandatory Release Governance

## The Iron Rule: Automatic Release Lifecycle Protocol (Definition of Done)
Whenever any feature, UI overhaul, bugfix, or enhancement is completed in Markbel:

1. **Never Stop at Code Implementation or Edge Worker Deployment:**
   - A task is NEVER complete until the full release pipeline is executed.
   - The user must NEVER have to ask "what about the release" or "did you update the version".

2. **Permanent Latest Download URLs:**
   - All direct client download links in `src/views/LandingPage.tsx` and `src/components/modals/ReleaseNotesModal.tsx` MUST always point to GitHub's perpetual latest release pattern:
     - Android APK: `https://github.com/belal-waheed/markbel/releases/latest/download/Markbel.apk`
     - Firefox Extension: `https://github.com/belal-waheed/markbel/releases/latest/download/markbel-firefox-extension.zip`
     - Chromium Extension: `https://github.com/belal-waheed/markbel/releases/latest/download/markbel-extension.zip`
   - Never hardcode specific version tags into client download links.

3. **Mandatory Automated Release Sequence on Task Completion:**
   - **Step 1: Version Alignment:** Increment the semantic version in `package.json`, `extension/manifest.json`, `extension/manifest.firefox.json`, `index.html` (`softwareVersion`), `public/llms.txt`, and `public/llms-full.txt`.
   - **Step 2: Release Notes Sync:** Update `src/components/modals/ReleaseNotesModal.tsx` and the top announcement banner in `LandingPage.tsx` detailing the new deliverables.
   - **Step 3: Extension Packaging:** Run `npm run build:extension:all` to produce fresh `markbel-extension.zip` and `markbel-firefox-extension.zip`.
   - **Step 4: Unpacked Sync:** Copy `dist-extension/*` to `D:\apps\0-setup\markbel-extension\` so local browser testing is instant.
   - **Step 5: Quality Gate:** Run `npm test` (all 236+ tests must pass) and `npm run typecheck` (0 errors).
   - **Step 6: Edge Deployment:** Run `npx wrangler deploy` to update `https://mark.obel.workers.dev`.
   - **Step 7: Vault Synchronization:** Mark completed tasks in `inbox/Today.md` and update `projects/markbel/_markbel.md`.
   - **Step 8: Git Commit & Tag:** Stage files, commit with Conventional Commit message, tag with `v<version>`, and push both `main` and the tag to GitHub `origin`.
