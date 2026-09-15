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
        Shortcuts: <strong>Alt+B</strong> (HUD) • <strong>Alt+Shift+S</strong> (Quick Save)
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

  // Generate Small Promotional Tile (440x280)
  const smallPromoPath = path.resolve(__dirname, '..', 'extension', 'store-assets', 'small-promo-440x280.png');
  const promoPage = await context.newPage();
  await promoPage.setViewportSize({ width: 440, height: 280 });
  await promoPage.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body {
            width: 440px; height: 280px; overflow: hidden;
            background: radial-gradient(circle at 50% 20%, #1a263d 0%, #070b12 100%);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            position: relative; border: 1px solid rgba(0,240,255,0.2);
          }
          .badge {
            background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3);
            color: #00f0ff; padding: 4px 12px; border-radius: 9999px; font-size: 11px;
            font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;
          }
          .title {
            font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -0.04em; margin-bottom: 6px;
          }
          .title span { color: #00f0ff; }
          .subtitle {
            font-size: 13px; color: #94a3b8; text-align: center; max-width: 360px; line-height: 1.4;
          }
          .pill-row {
            display: flex; gap: 8px; margin-top: 18px;
          }
          .pill {
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
            color: #cbd5e1; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
          }
        </style>
      </head>
      <body>
        <div class="badge">Edge Extension</div>
        <div class="title">Mark<span>bel</span></div>
        <div class="subtitle">Smart bookmark manager with instant media extraction & offline vault.</div>
        <div class="pill-row">
          <div class="pill">⚡ 1-Click Save (Alt+B)</div>
          <div class="pill">📁 Smart Groups</div>
          <div class="pill">☁️ Edge Cloud</div>
        </div>
      </body>
    </html>
  `);
  await promoPage.screenshot({ path: smallPromoPath, type: 'png' });
  console.log('Small promo tile generated successfully at:', smallPromoPath);

  // Generate Large Promotional Tile / Banner (1400x560)
  const largePromoPath = path.resolve(__dirname, '..', 'extension', 'store-assets', 'large-promo-1400x560.png');
  const bannerPage = await context.newPage();
  await bannerPage.setViewportSize({ width: 1400, height: 560 });
  await bannerPage.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body {
            width: 1400px; height: 560px; overflow: hidden;
            background: radial-gradient(circle at 65% 30%, #192742 0%, #060910 100%);
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 100px; position: relative; border: 1px solid rgba(0,240,255,0.2);
          }
          .left {
            max-width: 650px; display: flex; flex-direction: column; gap: 16px;
          }
          .badge {
            display: inline-flex; align-items: center; gap: 8px; width: fit-content;
            background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3);
            color: #00f0ff; padding: 6px 16px; border-radius: 9999px; font-size: 13px;
            font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
          }
          .title {
            font-size: 56px; font-weight: 900; color: #ffffff; letter-spacing: -0.04em; line-height: 1.05;
          }
          .title span { color: #00f0ff; }
          .subtitle {
            font-size: 18px; color: #94a3b8; line-height: 1.5;
          }
          .pill-row {
            display: flex; gap: 12px; margin-top: 8px;
          }
          .pill {
            background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12);
            color: #f1f5f9; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px;
          }
          .card-mockup {
            width: 420px; background: #0b111e; border: 1px solid rgba(0,240,255,0.3);
            border-radius: 20px; padding: 24px; box-shadow: 0 30px 70px -15px rgba(0,0,0,0.9), 0 0 40px rgba(0,240,255,0.15);
            display: flex; flex-direction: column; gap: 14px;
          }
          .mockup-header {
            display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;
          }
          .mockup-title { font-size: 14px; font-weight: 800; color: #00f0ff; letter-spacing: 0.08em; }
          .mockup-tag { background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 4px; }
          .mockup-thumb { width: 100%; height: 160px; background: #151d2f; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.06); }
          .mockup-item { font-size: 14px; font-weight: bold; color: #ffffff; }
          .mockup-desc { font-size: 12px; color: #64748b; line-height: 1.4; }
        </style>
      </head>
      <body>
        <div class="left">
          <div class="badge">Official Edge Extension</div>
          <div class="title">Save Anything in <span>0ms</span></div>
          <div class="subtitle">Capture rich media links, YouTube videos, articles, and research quotes with instant offline search and seamless cloud sync.</div>
          <div class="pill-row">
            <div class="pill">⌨️ Shortcut: Alt+B</div>
            <div class="pill">🎯 Auto Smart Groups</div>
            <div class="pill">⚡ 0ms Offline Sync</div>
          </div>
        </div>
        <div class="card-mockup">
          <div class="mockup-header">
            <div class="mockup-title">MARKBEL HUD</div>
            <div class="mockup-tag">Auto: YT</div>
          </div>
          <div class="mockup-thumb">Rich Media & Video Preview</div>
          <div class="mockup-item">Next-Gen Edge Architecture</div>
          <div class="mockup-desc">Instant offline-first synchronization powered by Dexie.js and Cloudflare D1.</div>
        </div>
      </body>
    </html>
  `);
  await bannerPage.screenshot({ path: largePromoPath, type: 'png' });
  console.log('Large promo banner generated successfully at:', largePromoPath);

  await context.close();
}

generateScreenshot().catch(err => {
  console.error('Error generating screenshot:', err);
  process.exit(1);
});
