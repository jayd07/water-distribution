// Pre-build script: Cleans previous build outputs and stale cache artifacts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pathsToClean = [
  path.join(rootDir, 'dist'),
  path.join(rootDir, 'dev-dist'),
  path.join(rootDir, 'node_modules/.vite'),
];

console.log('[Pipeline] Running pre-build clean for cache invalidation...');

for (const targetPath of pathsToClean) {
  if (fs.existsSync(targetPath)) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`[Pipeline] Purged stale directory: ${path.relative(rootDir, targetPath)}`);
    } catch (err) {
      console.warn(`[Pipeline] Warning cleaning ${targetPath}:`, err.message);
    }
  }
}

// Ensure dist directory exists for build outputs
fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });

console.log('[Pipeline] Pre-build clean completed.');
