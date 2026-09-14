const { chromium } = require('@playwright/test');
const path = require('path');

const extPath = path.resolve(__dirname, '..', 'dist-extension');
const outputPath = path.resolve(__dirname, '..', 'extension', 'store-assets', 'screenshot-1280x800.png');

async function generateScreenshot() {
  console.log('Generating 1280x800 Microsoft Edge Add-ons Store Screenshot...');

  const context = await chromium.launchPersistentContext('', {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`
    ]
  });

  await new Promise(r => setTimeout(r, 1200));

  const sws = context.serviceWorkers();
  let extId = '';
  for (const sw of sws) {
    const match = sw.url().match(/chrome-extension:\/\/([a-z0-9]+)\//i);
    if (match) {
      extId = match[1];
      break;
    }
  }

  if (!extId) {
    console.error('Could not detect extension ID');
    await context.close();
    process.exit(1);
  }

  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Navigate directly inside the extension origin
  await page.goto(`chrome-extension://${extId}/popup/index.html`);
  await page.waitForLoadState('networkidle');

  // Fill in realistic preview data
  await page.evaluate(() => {
    const viewAuth = document.getElementById('view-auth');
    const viewSave = document.getElementById('view-save');
    if (viewAuth) viewAuth.classList.add('hidden');
    if (viewSave) {
      viewSave.classList.remove('hidden');
      viewSave.style.display = 'block';
    }

    const titleInput = document.getElementById('input-title');
    const urlInput = document.getElementById('input-url');
    const descInput = document.getElementById('input-desc');
    const chips = document.querySelectorAll('.chip');

    if (titleInput) titleInput.value = 'Cloudflare Workers & D1 Architecture Deep Dive';
    if (urlInput) urlInput.value = 'https://blog.cloudflare.com/workers-database-d1';
    if (descInput) descInput.value = 'Zero-latency SQLite edge persistence and distributed read replication.';

    chips.forEach(chip => {
      if (chip.getAttribute('data-group') === 'YT') {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    // Style the page into a 1280x800 store showcase banner
    document.documentElement.style.width = '1280px';
    document.documentElement.style.height = '800px';
    document.documentElement.style.overflow = 'hidden';

    document.body.style.width = '1280px';
    document.body.style.height = '800px';
    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'column';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.background = 'radial-gradient(circle at 50% 25%, #182238 0%, #080c14 100%)';
    document.body.style.position = 'relative';

    const hud = document.querySelector('.hud-container');
    if (hud) {
      hud.style.width = '380px';
      hud.style.backgroundColor = '#0b0f19';
      hud.style.borderRadius = '16px';
      hud.style.border = '1px solid rgba(255, 255, 255, 0.12)';
      hud.style.boxShadow = '0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 240, 255, 0.15)';
      hud.style.padding = '18px';
      hud.style.zIndex = '10';
    }

    // Add ambient background elements and banner header
    const banner = document.createElement('div');
    banner.style.position = 'absolute';
    banner.style.top = '48px';
    banner.style.display = 'flex';
    banner.style.flexDirection = 'column';
    banner.style.alignItems = 'center';
    banner.style.gap = '10px';
    banner.style.zIndex = '5';
    banner.innerHTML = `
      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,240,255,0.08);border:1px solid rgba(0,240,255,0.25);padding:5px 14px;border-radius:9999px;font-size:12px;font-weight:600;color:#00f0ff;letter-spacing:0.04em;text-transform:uppercase;">
        Markbel for Microsoft Edge
      </div>
      <h1 style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;margin:0;">
        1-Click Bookmark HUD & <span style="color:#00f0ff;">Smart Groups</span>
      </h1>
      <p style="font-size:14px;color:#94a3b8;margin:0;">Instant metadata extraction, offline Dexie vault, and Cloudflare D1 sync</p>
    `;
    document.body.insertBefore(banner, hud);

    const footer = document.createElement('div');
    footer.style.position = 'absolute';
    footer.style.bottom = '40px';
    footer.style.display = 'flex';
    footer.style.gap = '20px';
    footer.style.zIndex = '5';
    footer.innerHTML = `
      <div style="font-size:12px;font-weight:500;color:#64748b;background:rgba(15,23,42,0.6);padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
        Shortcuts: <strong>Alt+Shift+M</strong> (HUD) • <strong>Alt+Shift+S</strong> (Quick Save)
      </div>
      <div style="font-size:12px;font-weight:500;color:#64748b;background:rgba(15,23,42,0.6);padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
        Smart Auto-Organize: <strong>YT, Insta, X, Unsorted</strong>
      </div>
    `;
    document.body.appendChild(footer);
  });

  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: outputPath, type: 'png' });
  console.log('Store screenshot generated successfully at:', outputPath);

  await context.close();
}

generateScreenshot().catch(err => {
  console.error('Error generating screenshot:', err);
  process.exit(1);
});
