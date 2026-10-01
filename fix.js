const fs = require('fs');
let code = fs.readFileSync('src/db/SyncManager.ts', 'utf8');
code = code.replace(/async function asyncResolveApiUrl[\s\S]*?return resolveApiUrl\(path\);\n}/, 
sync function asyncResolveApiUrl(path: string): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('apiUrl');
    if (data.apiUrl) {
       let clean = data.apiUrl.trim().replace(/\\/\\$/, '');
       if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = clean.startsWith('localhost') || clean.startsWith('127.0.0.1') ? \http://\\ : \https://\\;
       }
       if (!clean.endsWith('/api')) clean += '/api';
       const cleanPath = path.startsWith('/api/') ? path.slice(4) : path;
       const normalizedPath = cleanPath.startsWith('/') ? cleanPath : \/\\;
       return \\\\;
    }
  }
  return resolveApiUrl(path);
});
fs.writeFileSync('src/db/SyncManager.ts', code);
