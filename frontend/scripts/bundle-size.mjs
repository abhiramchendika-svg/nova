// Measures what each kind of first visit downloads (gzip), and checks it against bundle-budget.json.
//   node scripts/bundle-size.mjs           → report, exit 1 if over budget
//   node scripts/bundle-size.mjs --update  → write today's sizes + 10% headroom as the new budget
// Needs a production build with a manifest (`npm run build`).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: on Windows the latter gives '/C:/…', which fs can't open
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const MANIFEST = join(DIST, '.vite/manifest.json');
const BUDGET = fileURLToPath(new URL('../bundle-budget.json', import.meta.url));
const HEADROOM = 1.1;

if (!existsSync(MANIFEST)) {
  console.error('No dist/.vite/manifest.json: run `npm run build` first.');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const gz = (file) => gzipSync(readFileSync(join(DIST, file)), { level: 9 }).length;

/** Every file a chunk needs before it can run: itself, its static imports (recursively) and their CSS. */
function closure(keys) {
  const files = new Set();
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Not in the manifest: ${key}`);
    files.add(chunk.file);
    (chunk.css ?? []).forEach((c) => files.add(c));
    (chunk.imports ?? []).forEach(visit);
  };
  keys.forEach(visit);
  return files;
}

const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
const page = (name) => {
  const key = Object.keys(manifest).find((k) => k.endsWith(`/${name}.tsx`));
  if (!key) throw new Error(`No chunk for ${name}`);
  return key;
};

/** First visits that matter: what must arrive before each screen can show. */
const journeys = {
  'landing (/)': [entry],
  'log in (/login)': [entry, page('LoginPage')],
  'home after log-in (/app)': [entry, page('AppShell'), page('HomePage')],
};

const measure = (files) => {
  let js = 0;
  let css = 0;
  for (const f of files) f.endsWith('.css') ? (css += gz(f)) : (js += gz(f));
  return { js, css };
};

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const results = Object.fromEntries(
  Object.entries(journeys).map(([name, keys]) => [name, measure(closure(keys))]),
);
const largest = Object.values(manifest)
  .filter((c) => c.file.endsWith('.js'))
  .map((c) => ({ file: c.file, size: gz(c.file) }))
  .sort((a, b) => b.size - a.size)[0];

if (process.argv.includes('--update')) {
  const budget = {
    note: 'gzip bytes; `npm run size -- --update` rewrites this with 10% headroom over the current build',
    journeys: Object.fromEntries(
      Object.entries(results).map(([n, r]) => [
        n,
        { js: Math.ceil(r.js * HEADROOM), css: Math.ceil(r.css * HEADROOM) },
      ]),
    ),
    largestChunk: Math.ceil(largest.size * HEADROOM),
  };
  writeFileSync(BUDGET, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Wrote ${BUDGET}`);
}

const budget = JSON.parse(readFileSync(BUDGET, 'utf8'));
let over = false;
console.log('First visit (gzip)            JS (budget)            CSS (budget)');
for (const [name, r] of Object.entries(results)) {
  const b = budget.journeys[name];
  const flag = (v, max) => (v > max ? ((over = true), ' OVER') : '');
  console.log(
    `${name.padEnd(28)}  ${kb(r.js).padStart(9)} (${kb(b.js)})${flag(r.js, b.js)}`.padEnd(56) +
      `${kb(r.css).padStart(9)} (${kb(b.css)})${flag(r.css, b.css)}`,
  );
}
const tooBig = largest.size > budget.largestChunk;
over ||= tooBig;
console.log(
  `Largest chunk: ${largest.file} ${kb(largest.size)} (budget ${kb(budget.largestChunk)})${tooBig ? ' OVER' : ''}`,
);
if (over) {
  console.error(
    '\nOver the bundle budget. Split or trim the code, or, if the growth is deliberate, run `npm run size -- --update` and commit bundle-budget.json.',
  );
  process.exit(1);
}
