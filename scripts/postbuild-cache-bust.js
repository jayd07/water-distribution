// Post-build script: Invalidate caches, generate version manifest & deployment cache headers
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

console.log('[Pipeline] Running post-build cache invalidation & header generation...');

if (!fs.existsSync(distDir)) {
  console.error('[Pipeline] Error: dist/ directory not found. Run build first.');
  process.exit(1);
}

// 1. Generate unique build stamp and hash
const now = new Date();
const buildTimestamp = now.getTime();
const buildDate = now.toISOString();
const buildId = crypto.randomBytes(6).toString('hex');

const versionData = {
  version: '1.0.0',
  buildId,
  buildTimestamp,
  buildDate,
  cacheInvalidated: true,
  environment: process.env.NODE_ENV || 'production'
};

// Write version.json to dist/ and public/
fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf-8');
if (fs.existsSync(publicDir)) {
  fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf-8');
}
console.log(`[Pipeline] Generated version manifest: buildId=${buildId}, timestamp=${buildTimestamp}`);

// 2. Generate _headers file for Edge/CDN cache control (Netlify, Cloudflare Pages, etc.)
const headersContent = `# Cache Invalidation Rules generated at ${buildDate}

# Entry HTML: Must never be cached permanently so users immediately receive new asset hashes
/index.html
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff

# Service Worker & Manifest: Must always check for latest version
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/workbox-*.js
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/manifest.webmanifest
  Cache-Control: no-cache, no-store, must-revalidate

/version.json
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

# Static immutable assets: Fingerprinted with content hashes, safe to cache long-term
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

fs.writeFileSync(path.join(distDir, '_headers'), headersContent, 'utf-8');
console.log('[Pipeline] Generated dist/_headers with strict Cache-Control directives.');

// 3. Generate / Update firebase.json hosting headers configuration
const firebaseConfig = {
  hosting: {
    public: "dist",
    ignore: [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    headers: [
      {
        source: "index.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      },
      {
        source: "sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      },
      {
        source: "version.json",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      },
      {
        source: "manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }
        ]
      },
      {
        source: "/assets/**",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      }
    ],
    rewrites: [
      {
        source: "**",
        destination: "/index.html"
      }
    ]
  }
};

fs.writeFileSync(path.join(rootDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2), 'utf-8');
console.log('[Pipeline] Configured firebase.json with deployment cache invalidation rules.');

// 4. Verify hashed asset output
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const assets = fs.readdirSync(assetsDir);
  console.log(`[Pipeline] Verified ${assets.length} content-hashed asset files in dist/assets.`);
}

console.log('[Pipeline] Cache invalidation deployment pipeline step completed successfully.');
