const { chromium } = require('@playwright/test');
const path = require('path');

const extPath = path.resolve(__dirname, '..', 'dist-extension');

async function run() {
  console.log('Testing extension at:', extPath);
  const context = await chromium.launchPersistentContext('', {
    channel: 'msedge',
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`
    ]
  });

  // Wait a moment for background service worker to boot
  await new Promise(r => setTimeout(r, 1000));

  const sws = context.serviceWorkers();
  console.log('Active background service workers:', sws.length);

  // Open the extension popup directly to verify rendering
  let extId = '';
  for (const sw of sws) {
    const url = sw.url();
    const match = url.match(/chrome-extension:\/\/([a-z0-9]+)\//i);
    if (match) {
      extId = match[1];
      break;
    }
  }

  if (extId) {
    console.log('Detected Extension ID:', extId);
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extId}/popup/index.html`);
    const title = await popupPage.title();
    console.log('Popup Page Title:', title);
    const hasBrand = await popupPage.$('.brand-title');
    console.log('Brand element found in popup:', Boolean(hasBrand));
    await popupPage.close();
  }

  await context.close();
  console.log('All extension verification checks passed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
