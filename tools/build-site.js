// Assembles the static demo site: the two unmodified web builds, each with the
// demo environment scripts loaded ahead of its bundle, beside the outer page.
// Usage: node build-site.js <outer page.html> <out dir>
const fs = require('fs');
const path = require('path');

const [outer, out] = process.argv.slice(2);
const HERE = __dirname;
// The day the data was recorded; the page pins "today" to it.
const DEMO_DATE = process.env.DEMO_DATE || '2026-10-30';
const DAY = DEMO_DATE.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n));
const DAY_LABEL = new Date(Date.UTC(DAY[0], DAY[1], DAY[2], 12)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const API_HOST = 'https://health.tailc51c3c.ts.net';

fs.rmSync(out, { recursive: true, force: true });

function copyTree(src, dst) {
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name), d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyTree(s, d);
    else if (ent.name !== 'metadata.json') { fs.mkdirSync(dst, { recursive: true }); fs.copyFileSync(s, d); }
  }
}

// The export uses root-absolute paths; the site serves each app from a subfolder.
function relativize(dir) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (!/\.(js|html)$/.test(e.name)) return;
    const s = fs.readFileSync(p, 'utf8');
    const t = s.replace(/"\/(_expo|assets)\//g, '"./$1/');
    if (t !== s) fs.writeFileSync(p, t);
  });
  walk(dir);
}

function app(name, storage, extra) {
  const dir = path.join(out, name);
  copyTree(path.join(HERE, name, 'dist-web'), dir);
  relativize(dir);
  fs.copyFileSync(path.join(HERE, 'demo-env.js'), path.join(dir, 'demo-env.js'));
  for (const [from, to] of extra) fs.copyFileSync(from, path.join(dir, to));
  const config = `<script>window.__DEMO_DAY=${JSON.stringify(DAY)};window.__DEMO_API_HOST=${JSON.stringify(API_HOST)};window.__DEMO_STORAGE=${JSON.stringify(storage)};</script>`;
  const scripts = ['demo-env.js', ...extra.filter(([, to]) => to.endsWith('.js')).map(([, to]) => to)].map((s) => `<script src="./${s}"></script>`).join('');
  const index = path.join(dir, 'index.html');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('</head>', `  ${config}${scripts}\n  </head>`));
}

const recordings = JSON.parse(fs.readFileSync(path.join(HERE, 'recordings.json'), 'utf8'));
const profiles = JSON.parse(recordings.find((e) => e.path === '/api/profiles').body);
const sam = (profiles.profiles || profiles).find((p) => /sam/i.test(p.name || p.display_name || p.id));
app('health', { account_token: 'demo', profile: sam.id, onboarding_complete_v1: 'true', whats_new_seen_v1: '9999' }, [
  [path.join(HERE, 'replay.js'), 'replay.js'],
]);
fs.copyFileSync(path.join(HERE, 'recordings.json'), path.join(out, 'health', 'recordings.json'));
app('claro', JSON.parse(fs.readFileSync(path.join(HERE, 'claro-seed.json'), 'utf8')), []);
fs.writeFileSync(path.join(out, 'index.html'), fs.readFileSync(outer, 'utf8').replace(/\{\{DEMO_DAY\}\}/g, DAY_LABEL));

const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(path.relative(out, p)); });
walk(out);
console.log(JSON.stringify({ profile: sam.id, files }, null, 1));
