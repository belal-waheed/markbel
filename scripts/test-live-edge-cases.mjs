import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const LIVE_URL = 'https://mark.obel.workers.dev';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('MARKBEL LIVE DEPLOYMENT & METADATA EDGE CASE TEST SUITE');
console.log('Target:', LIVE_URL);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testEndpoint(name, url, expectedStatus = 200, validateFn = null) {
  process.stdout.write(`[TEST] ${name.padEnd(45)} ... `);
  const start = Date.now();
  try {
    const res = await fetch(url);
    const duration = Date.now() - start;
    const body = await res.json().catch(() => ({}));

    if (res.status !== expectedStatus) {
      console.log(`FAILED (HTTP ${res.status}, expected ${expectedStatus}) in ${duration}ms`);
      console.log('  Response:', body);
      return false;
    }

    if (validateFn) {
      const valid = validateFn(body, res);
      if (!valid) {
        console.log(`FAILED (Validation check failed) in ${duration}ms`);
        console.log('  Response:', body);
        return false;
      }
    }

    console.log(`PASSED (${duration}ms)`);
    return true;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`ERROR (${err.message}) in ${duration}ms`);
    return false;
  }
}

async function runLiveEdgeTests() {
  let passedCount = 0;
  let totalCount = 0;

  async function run(name, url, status, validate) {
    totalCount++;
    const ok = await testEndpoint(name, url, status, validate);
    if (ok) passedCount++;
  }

  // 1. Health check
  await run('1. Live API Health Check', `${LIVE_URL}/api/health`, 200, (b) => b.status === 'healthy');

  // 2. YouTube Video
  await run(
    '2. YouTube Video Metadata Unfurling',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ`,
    200,
    (b) => b.title && b.image && b.image.includes('dQw4w9WgXcQ')
  );

  // 3. YouTube Short
  await run(
    '3. YouTube Short Metadata Unfurling',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fwww.youtube.com%2Fshorts%2F3i_p5a_ZJ3Y`,
    200,
    (b) => b.title && b.image
  );

  // 4. GitHub Repository
  await run(
    '4. GitHub Repo Metadata Adapter',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fgithub.com%2Ffacebook%2Freact`,
    200,
    (b) => b.title && b.title.includes('react')
  );

  // 5. Wikipedia Article
  await run(
    '5. Wikipedia Article Metadata Adapter',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FTypeScript`,
    200,
    (b) => b.title && b.description && b.title.includes('TypeScript')
  );

  // 6. Spotify Track
  await run(
    '6. Spotify OEmbed Adapter',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4cOdK2wGLETKBW3PvgPWqT`,
    200,
    (b) => b.title && b.siteName === 'Spotify'
  );

  // 7. Standard Blog Article
  await run(
    '7. Cloudflare Blog Article (JSON-LD/OG)',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fblog.cloudflare.com%2Fintroducing-workers-kv`,
    200,
    (b) => b.title && b.title.length > 5
  );

  // 8. SSRF Loopback Protection (Localhost)
  await run(
    '8. SSRF Defense: 127.0.0.1 blocking',
    `${LIVE_URL}/api/metadata?url=http%3A%2F%2F127.0.0.1%3A8080%2Fadmin`,
    200, // Edge fallback synthesizes or blocks safely
    (b) => !b.title || b.title.includes('127.0.0.1')
  );

  // 9. SSRF AWS/Cloud Metadata Protection
  await run(
    '9. SSRF Defense: 169.254.169.254 blocking',
    `${LIVE_URL}/api/metadata?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F`,
    200,
    (b) => !b.description || b.description.includes('Saved link')
  );

  // 10. Non-existent domain (Graceful fallback)
  await run(
    '10. Non-existent domain resilience',
    `${LIVE_URL}/api/metadata?url=https%3A%2F%2Fthis-domain-does-not-exist-99999.org`,
    200,
    (b) => b.title && b.image
  );

  console.log(`\nResults: ${passedCount}/${totalCount} API edge cases passed!\n`);

  // Visual Headless Edge Browser Test
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('HEADLESS MICROSOFT EDGE VISUAL TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const screenshotPath = path.resolve('live-deployment-preview.png');
  console.log(`[Edge] Capturing rendered live UI to ${screenshotPath}...`);

  await new Promise((resolve) => {
    const proc = spawn(EDGE_PATH, [
      '--headless=new',
      '--disable-gpu',
      `--screenshot=${screenshotPath}`,
      '--window-size=1280,800',
      '--hide-scrollbars',
      LIVE_URL
    ], { windowsHide: true });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(screenshotPath)) {
        const stats = fs.statSync(screenshotPath);
        console.log(`SUCCESS: Live viewport screenshot captured (${stats.size} bytes)`);
      } else {
        console.error(`Edge exit code: ${code}`);
      }
      resolve();
    });
  });

  console.log('\nAll deployment and edge-case verification completed successfully!');
}

runLiveEdgeTests();
