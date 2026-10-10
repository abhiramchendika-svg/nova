// Checks that vercel.json's Content-Security-Policy allows exactly the inline scripts in the built
// index.html (the theme script that runs before first paint). Editing that script changes its hash; this
// fails the build until vercel.json is updated, instead of the live site silently losing the script.
// Run after `npm run build`: npm run csp
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(`${root}dist/index.html`, 'utf8');
const vercel = JSON.parse(readFileSync(`${root}vercel.json`, 'utf8'));

const csp = vercel.headers
  .flatMap((rule) => rule.headers)
  .find((h) => h.key === 'Content-Security-Policy')?.value;
if (!csp) {
  console.error('vercel.json has no Content-Security-Policy header.');
  process.exit(1);
}
const scriptSrc = csp
  .split(';')
  .map((d) => d.trim())
  .find((d) => d.startsWith('script-src '));

const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const needed = inline.map((code) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`);
const allowed = new Set(scriptSrc?.split(/\s+/).filter((t) => t.startsWith("'sha256-")) ?? []);

const missing = needed.filter((h) => !allowed.has(h));
const stale = [...allowed].filter((h) => !needed.includes(h));
if (missing.length || stale.length) {
  console.error('vercel.json script-src is out of date with dist/index.html.');
  if (missing.length) console.error(`  add:    ${missing.join(' ')}`);
  if (stale.length) console.error(`  remove: ${stale.join(' ')}`);
  process.exit(1);
}
console.log(`CSP ok: ${needed.length} inline script(s) allowed by hash, nothing else inline.`);
