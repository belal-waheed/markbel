const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'dist-extension');
const destDir = 'D:\\apps\\0-setup\\markbel-extension';

if (!fs.existsSync(srcDir)) {
  console.error(`Source directory does not exist: ${srcDir}`);
  process.exit(1);
}

if (fs.existsSync(destDir)) {
  // Clean assets/ subfolder specifically to eliminate stale hashed chunks
  const assetsDir = path.join(destDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    fs.rmSync(assetsDir, { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy all built assets recursively
fs.cpSync(srcDir, destDir, { recursive: true });
console.log(`Successfully mirrored dist-extension to ${destDir} with clean assets.`);
