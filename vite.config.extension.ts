import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'extension/src/popup/index.html'),
        options: path.resolve(__dirname, 'extension/src/options/index.html'),
        background: path.resolve(__dirname, 'extension/src/background.ts'),
        content: path.resolve(__dirname, 'extension/src/content.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [
    {
      name: 'copy-extension-manifest-and-icons',
      closeBundle() {
        const outDir = path.resolve(__dirname, 'dist-extension');

        // Copy manifest.json
        const manifestSrc = path.resolve(__dirname, 'extension/manifest.json');
        const manifestDest = path.resolve(outDir, 'manifest.json');
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDest);
        }

        // Copy icons directory
        const iconsSrc = path.resolve(__dirname, 'extension/icons');
        const iconsDest = path.resolve(outDir, 'icons');
        if (fs.existsSync(iconsSrc)) {
          fs.mkdirSync(iconsDest, { recursive: true });
          for (const file of fs.readdirSync(iconsSrc)) {
            fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDest, file));
          }
        }

        // Ensure popup/index.html and options/index.html are in dist-extension/popup and dist-extension/options
        // If Vite placed them in nested paths like dist-extension/extension/src/popup/index.html:
        const nestedPopup = path.resolve(outDir, 'extension/src/popup/index.html');
        if (fs.existsSync(nestedPopup)) {
          const targetDir = path.resolve(outDir, 'popup');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(nestedPopup, path.resolve(targetDir, 'index.html'));
        }

        const nestedOptions = path.resolve(outDir, 'extension/src/options/index.html');
        if (fs.existsSync(nestedOptions)) {
          const targetDir = path.resolve(outDir, 'options');
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(nestedOptions, path.resolve(targetDir, 'index.html'));
        }
      }
    }
  ]
});
