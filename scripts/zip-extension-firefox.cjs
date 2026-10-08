const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const extDir = path.join(__dirname, '..', 'dist-extension-firefox');
const zipOut = path.join(__dirname, '..', 'markbel-firefox-extension.zip');

if (fs.existsSync(zipOut)) {
  fs.unlinkSync(zipOut);
}

if (process.platform === 'win32') {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${extDir}/*' -DestinationPath '${zipOut}' -Force"`, { stdio: 'inherit' });
} else {
  execSync(`cd "${extDir}" && zip -r "${zipOut}" .`, { stdio: 'inherit' });
}

console.log('markbel-firefox-extension.zip created successfully at:', zipOut);
