import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:/Users/bel/.gemini/antigravity/brain/28ddae41-4d05-432e-8c8d-99a6cdb5d821';
const LIVE_URL = 'https://mark.obel.workers.dev';

async function runVisualVerification() {
  console.log('[Verify] Launching Google Chrome...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // HiDPI crisp screenshots
  });

  const page = await context.newPage();

  console.log(`[Verify] Navigating to ${LIVE_URL}...`);
  await page.goto(LIVE_URL, { waitUntil: 'networkidle' });

  // 1. Landing Hero & Banner
  console.log('[Verify] 1. Capturing Landing Page Hero & Banner...');
  await page.waitForSelector('text=Markbel v2.3.0 is live!');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '01_landing_hero.png'),
    fullPage: false,
  });

  // 2. Open Release Notes Modal
  console.log('[Verify] 2. Opening Release Notes Modal...');
  const releaseNotesBtn = page.locator('button:has-text("What\'s New in v2.3.0")').first();
  await releaseNotesBtn.click();
  await page.waitForSelector('text=What\'s New in Markbel v2.3.0');
  await page.waitForTimeout(600); // allow fade-in animation
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '02_release_notes_modal.png'),
  });

  // Close Release Notes Modal
  console.log('[Verify] Closing Release Notes Modal...');
  const closeReleaseBtn = page.locator('button:has-text("Close")').first();
  await closeReleaseBtn.click();
  await page.waitForTimeout(400);

  // 3. Scroll to Platforms and Open Extension Setup Modal
  console.log('[Verify] 3. Scrolling to Chrome & Brave Setup Guide...');
  const setupBtn = page.locator('button:has-text("Chrome & Brave Setup Guide")').first();
  await setupBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await setupBtn.click();

  await page.waitForSelector('text=Install Markbel Extension');
  await page.waitForTimeout(600); // allow modal animation

  console.log('[Verify] Capturing Extension Setup Modal Step 1...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '03_extension_setup_modal_step1.png'),
  });

  // 4. Test Step 2 and Copy URL
  console.log('[Verify] 4. Testing Step 2 (Developer Mode & chrome://extensions)...');
  const step2Btn = page.locator('button:has-text("Developer Mode")').first();
  await step2Btn.click();
  await page.waitForTimeout(400);

  const copyUrlBtn = page.locator('button:has-text("Copy URL")').first();
  await copyUrlBtn.click();
  await page.waitForTimeout(300);

  console.log('[Verify] Capturing Extension Setup Modal Step 2 with Copied URL indicator...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '04_extension_setup_modal_step2_copied.png'),
  });

  // 5. Test Step 3 (Load Unpacked & Pin)
  console.log('[Verify] 5. Testing Step 3 (Load Unpacked & Pin)...');
  const step3Btn = page.locator('button:has-text("Load & Pin")').first();
  await step3Btn.click();
  await page.waitForTimeout(400);

  console.log('[Verify] Capturing Extension Setup Modal Step 3...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '05_extension_setup_modal_step3.png'),
  });

  // 6. Test Edge Add-ons Tab Switch
  console.log('[Verify] 6. Testing Edge Add-ons tab switch...');
  const edgeTabBtn = page.locator('button:has-text("Microsoft Edge")').first();
  await edgeTabBtn.click();
  await page.waitForTimeout(400);

  console.log('[Verify] Capturing Extension Setup Modal Edge Add-ons Tab...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, '06_extension_setup_modal_edge.png'),
  });

  console.log('[Verify] SUCCESS: All 6 screenshots captured successfully in artifact directory.');
  await browser.close();
}

runVisualVerification().catch((err) => {
  console.error('[Verify Error]:', err);
  process.exit(1);
});
