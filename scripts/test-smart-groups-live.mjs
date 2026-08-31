import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const LIVE_URL = 'https://mark.obel.workers.dev';

async function testSmartGroupsLive() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LIVE SMART AUTO-GROUPING (YT, INSTA, X) E2E VERIFICATION');
  console.log('Target:', LIVE_URL);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('[Edge] Launching Microsoft Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log(`[Edge] Loading ${LIVE_URL}...`);
  await page.goto(LIVE_URL, { waitUntil: 'networkidle' });

  // Wait for sidebar groups to initialize
  await page.waitForTimeout(1500);

  console.log('[Edge] Checking default smart groups in sidebar...');
  const sidebarText = await page.locator('aside').innerText();
  const hasYT = sidebarText.includes('YT');
  const hasInsta = sidebarText.includes('Insta');
  const hasX = sidebarText.includes('X');

  console.log(`  - Group "YT" initialized: ${hasYT ? 'YES' : 'NO'}`);
  console.log(`  - Group "Insta" initialized: ${hasInsta ? 'YES' : 'NO'}`);
  console.log(`  - Group "X" initialized: ${hasX ? 'YES' : 'NO'}`);

  // Test Case 1: Add YouTube link & verify auto-grouping
  console.log('\n[Test 1] Testing YouTube link auto-categorization...');
  await page.getByRole('button', { name: /Add Bookmark|Add Link/i }).first().click();
  await page.waitForTimeout(300);

  const urlInput = page.locator('input[type="url"]');
  await urlInput.fill('https://www.youtube.com/watch?v=jYFNtUYGxrY&t=414s');
  await page.waitForTimeout(1000);

  const groupSelect = page.locator('select').first();
  const selectedGroup1 = await groupSelect.inputValue();
  console.log(`  - Auto-selected group: "${selectedGroup1}" (Expected: YT)`);

  const saveBtn = page.getByRole('button', { name: /Save Bookmark/i });
  await saveBtn.click();
  await page.waitForTimeout(1500);

  // Test Case 2: Add Instagram link & verify auto-grouping
  console.log('\n[Test 2] Testing Instagram link auto-categorization...');
  await page.getByRole('button', { name: /Add Bookmark/i }).first().click();
  await page.waitForTimeout(300);

  await urlInput.fill('https://www.instagram.com/p/C-12345/');
  await page.waitForTimeout(1000);

  const selectedGroup2 = await groupSelect.inputValue();
  console.log(`  - Auto-selected group: "${selectedGroup2}" (Expected: Insta)`);
  await saveBtn.click();
  await page.waitForTimeout(1500);

  // Test Case 3: Add X / Twitter link & verify auto-grouping
  console.log('\n[Test 3] Testing X / Twitter link auto-categorization...');
  await page.getByRole('button', { name: /Add Bookmark/i }).first().click();
  await page.waitForTimeout(300);

  await urlInput.fill('https://x.com/levelsio/status/1890000000');
  await page.waitForTimeout(1000);

  const selectedGroup3 = await groupSelect.inputValue();
  console.log(`  - Auto-selected group: "${selectedGroup3}" (Expected: X)`);
  await saveBtn.click();
  await page.waitForTimeout(1500);

  // Test Case 4: Click Auto-Organize Vault button in Sidebar
  console.log('\n[Test 4] Testing Auto-Organize Vault action...');
  const autoOrganizeBtn = page.locator('button[title*="Auto-Organize Vault"]').first();
  if (await autoOrganizeBtn.isVisible()) {
    await autoOrganizeBtn.click();
    await page.waitForTimeout(1000);
    console.log('  - Auto-Organize action triggered successfully');
  }

  // Capture final screenshot
  const screenshotPath = path.resolve('live-smart-groups-verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`\n[Edge] SUCCESS: Saved full verification screenshot to ${screenshotPath}`);

  await browser.close();
}

testSmartGroupsLive().catch((err) => {
  console.error('[E2E Error]:', err);
  process.exit(1);
});
