// Drives the real Health web build against the local demo server, recording every API exchange.
const { chromium } = require('playwright');
const fs = require('fs');
const HOST = 'https://health.tailc51c3c.ts.net';
const LOCAL = 'http://127.0.0.1:8080';
async function setup(opts = {}) {
  const login = await (await fetch(LOCAL + '/api/accounts/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'sam', password: 'demo-pass-123' }) })).json();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago' });
  const log = [];
  const errs = [];
  await ctx.addInitScript(([t, pid]) => { localStorage.setItem('account_token', t); localStorage.setItem('profile', pid); localStorage.setItem('onboarding_complete_v1', 'true'); localStorage.setItem('whats_new_seen_v1', '9999'); }, [login.token, login.profile.id]);
  if (opts.init) await ctx.addInitScript({ content: opts.init });
  await ctx.route(HOST + '/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body = req.postDataBuffer();
    const headers = { ...req.headers() };
    delete headers['host'];
    if (opts.rewrite) { const r = await opts.rewrite(req, url, body, headers); if (r) { body = r.body; Object.assign(headers, r.headers || {}); } }
    const resp = await fetch(LOCAL + url.pathname + url.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : body });
    const text = await resp.text();
    log.push({ method: req.method(), path: url.pathname + url.search, reqBody: req.method() === 'GET' ? null : (req.headers()['content-type'] || '').includes('json') ? (req.postData() || '') : '[form]', status: resp.status, body: text });
    await route.fulfill({ status: resp.status, contentType: resp.headers.get('content-type') || 'application/json', body: text, headers: { 'access-control-allow-origin': '*' } });
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  return { b, p, log, errs };
}
module.exports = { setup };
if (require.main === module) {
  (async () => {
    const { b, p, log, errs } = await setup();
    await p.goto('http://localhost:8412/'); await p.waitForTimeout(5000);
    await p.screenshot({ path: 'rec-today.png' });
    console.log((await p.evaluate(() => document.body.innerText)).slice(0, 1500));
    console.log(log.map((l) => `${l.status} ${l.method} ${l.path}`).join('\n'));
    console.log(errs.slice(0, 10));
    await b.close();
  })();
}
