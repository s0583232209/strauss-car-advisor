/**
 * Vercel build (Build Output API v3): writes .vercel/output with the built client as static files
 * and one Node function for /api/*. The server is bundled here with esbuild because Vercel's own
 * TypeScript builder cannot compile this project (TypeScript 7, .ts import extensions).
 *
 * Run after `vite build`: node scripts/vercel-build.mjs
 */

import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('.vercel/output');
const fnDir = path.join(out, 'functions/api.func');

if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `vite build` first');
rmSync(out, { recursive: true, force: true });
mkdirSync(fnDir, { recursive: true });

// Client: Vercel's CDN serves these files
cpSync('dist', path.join(out, 'static'), { recursive: true });

// API: a single self-contained bundle (no node_modules at runtime)
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: path.join(fnDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // CommonJS dependencies (express) call require() for Node built-ins
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url); process.env.NODE_ENV = 'production';",
  },
  logLevel: 'warning',
});

writeFileSync(path.join(fnDir, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  supportsResponseStreaming: true, // the agent turn streams NDJSON status lines
  maxDuration: 60, // an agent turn can take ~30s
}, null, 2));

writeFileSync(path.join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/api(/.*)?$', dest: '/api' },
    { handle: 'filesystem' },
    // Hashed build assets never change; everything else falls back to the SPA
    { src: '^/(.*)$', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
  ],
}, null, 2));

console.log('Vercel output written to .vercel/output');
