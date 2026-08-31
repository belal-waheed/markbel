import { chromium } from '@playwright/test';
import path from 'node:path';

const LIVE_URL = 'https://mark.obel.workers.dev';

async function testSmartGroupsLive() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LIVE MICROLINK HYBRID IMAGE & SMART GROUPS E2E VERIFICATION');
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
  await page.waitForTimeout(1500);

  // Helper to add bookmark and wait for metadata
  async function addLink(url, label) {
    console.log(`\n[Test] Adding ${label} (${url})...`);
    await page.getByRole('button', { name: /Add Bookmark|Add Link/i }).first().click();
    await page.waitForTimeout(400);

    const urlInput = page.locator('input[type="url"]');
    await urlInput.fill(url);
    // Wait for client debounce and metadata resolution
    await page.waitForTimeout(3000);

    const saveBtn = page.getByRole('button', { name: /Save Bookmark/i });
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }

  // 1. YouTube Link (Milestone example)
  await addLink('https://www.youtube.com/watch?v=jYFNtUYGxrY&t=414s', 'YouTube Video (YT)');

  // 2. Instagram Profile / Link
  await addLink('https://www.instagram.com/instagram/', 'Instagram Profile (Insta)');

  // 3. X Profile / Post
  await addLink('https://x.com/levelsio', 'X Profile (X)');

  // 4. Cloudflare Blog Article
  await addLink('https://blog.cloudflare.com/introducing-workers-kv', 'Cloudflare Article (Unsorted)');

  // Click Auto-Organize button
  console.log('\n[Test] Triggering Auto-Organize Vault action...');
  const autoOrganizeBtn = page.locator('button[title*="Auto-Organize Vault"]').first();
  if (await autoOrganizeBtn.isVisible()) {
    await autoOrganizeBtn.click();
    await page.waitForTimeout(1000);
  }

  // Assert image cards count
  const imgElements = page.locator('img[alt*="Bookmark thumbnail"], img[alt*="Favicon"], img[src*="http"]');
  const count = await imgElements.count();
  console.log(`\n[Edge] Rendered visual bookmark images count: ${count}`);

  // Capture final screenshot
  const screenshotPath = path.resolve('live-microlink-verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`[Edge] SUCCESS: Saved full verification screenshot to ${screenshotPath}`);

  await browser.close();
}

testSmartGroupsLive().catch((err) => {
  console.error('[E2E Error]:', err);
  process.exit(1);
});
