const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'extension', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const srcImage = path.join(__dirname, '..', 'public', 'logo.png');

async function run() {
  await sharp(srcImage).resize(16, 16).toFile(path.join(outDir, 'icon-16.png'));
  await sharp(srcImage).resize(48, 48).toFile(path.join(outDir, 'icon-48.png'));
  await sharp(srcImage).resize(128, 128).toFile(path.join(outDir, 'icon-128.png'));
  console.log('Icons generated successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
