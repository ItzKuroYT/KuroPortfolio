import { mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './generate.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const dest = path.join(root, 'dist');
if (path.dirname(dest) !== path.resolve(root)) throw new Error('Unsafe output path');
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
// Explicit allowlist: backend, environment files, tests and tools are never published.
const { readdir } = await import('node:fs/promises');
for (const file of await readdir(root)) if (/\.html$/.test(file)) await cp(path.join(root, file), path.join(dest, file));
for (const name of ['css', 'js', 'assets', 'robots.txt', 'sitemap.xml', '.nojekyll']) await cp(path.join(root, name), path.join(dest, name), { recursive: true });
console.log('Built static frontend in dist/ (no backend files or secrets).');
