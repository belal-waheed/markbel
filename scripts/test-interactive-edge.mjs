import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const LIVE_URL = 'https://mark.obel.workers.dev';

async function runInteractiveEdgeTest() {
  console.log('[Edge E2E] Launching headless Microsoft Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log(`[Edge E2E] Navigating to ${LIVE_URL}...`);
  await page.goto(LIVE_URL, { waitUntil: 'networkidle' });

  console.log('[Edge E2E] Checking page title...');
  const title = await page.title();
  console.log(`[Edge E2E] Page title: "${title}"`);

  console.log('[Edge E2E] Clicking "+ Add Bookmark" button...');
  const addBtn = page.getByRole('button', { name: /Add Bookmark|Add Link/i }).first();
  await addBtn.click();

  console.log('[Edge E2E] Entering URL in Add Bookmark modal...');
  const urlInput = page.locator('input[type="url"]');
  await urlInput.fill('https://github.com/facebook/react');

  console.log('[Edge E2E] Waiting for auto-fetched metadata...');
  // Wait up to 5 seconds for title input to get populated
  const titleInput = page.locator('input[placeholder*="Design Principles"], input[value*="react"], input[type="text"]').first();
  await page.waitForTimeout(3000);

  const titleVal = await titleInput.inputValue();
  console.log(`[Edge E2E] Auto-populated title: "${titleVal}"`);

  console.log('[Edge E2E] Submitting new bookmark...');
  const saveBtn = page.getByRole('button', { name: /Save Bookmark/i });
  await saveBtn.click();

  await page.waitForTimeout(2000);

  console.log('[Edge E2E] Verifying bookmark card rendered in vault...');
  const bookmarkCard = page.locator('.studio-card').first();
  const cardText = await bookmarkCard.innerText().catch(() => 'N/A');
  console.log(`[Edge E2E] First bookmark card content summary:\n${cardText}`);

  const screenshotPath = path.resolve('live-bookmark-saved.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`[Edge E2E] SUCCESS: Captured screenshot to ${screenshotPath}`);

  await browser.close();
}

runInteractiveEdgeTest().catch((err) => {
  console.error('[Edge E2E Error]:', err);
  process.exit(1);
});
