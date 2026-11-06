// Records the PickleCourts demo: drives the real consumer web build against the
// real PickleCourts API (invented venues, payments mocked) and saves every API
// exchange to pc-recordings.json. Then calls the same server's MCP tools the
// way an assistant would and saves that exchange to pc-mcp.json.
const fs = require('fs');
const { chromium } = require('playwright');
const HOST = 'https://picklecourts-demo.invalid';
const LOCAL = 'http://127.0.0.1:3001';
const DAY = process.env.DEMO_DATE;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago' });
  const log = [], errs = [];
  await ctx.route(HOST + '/**', async (route) => {
    const req = route.request(), url = new URL(req.url());
    const headers = { ...req.headers() }; delete headers.host;
    const resp = await fetch(LOCAL + url.pathname + url.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() });
    const text = await resp.text();
    log.push({ method: req.method(), path: url.pathname + url.search, reqBody: req.method() === 'GET' ? null : (req.postData() || ''), status: resp.status, body: text });
    await route.fulfill({ status: resp.status, contentType: resp.headers.get('content-type') || 'application/json', body: text, headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/maps\.googleapis\.com/, (r) => r.abort());
  // Same pinned clock the site uses: 11:30 AM on the demo day.
  const D = DAY.split('-').map(Number);
  await ctx.addInitScript({ content: `window.__DEMO_DAY=${JSON.stringify([D[0], D[1] - 1, D[2]])};` + fs.readFileSync(__dirname + '/demo-env.js', 'utf8') });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  p.on('pageerror', (e) => errs.push(e.message));
  const wait = (ms = 1500) => p.waitForTimeout(ms);
  const step = async (name, fn) => {
    const n0 = log.length;
    try { await fn(); } catch (e) { console.log('STEP FAILED', name, e.message.split('\n')[0]); }
    await wait(1800);
    console.log(`-- ${name}: ${log.slice(n0).map((l) => `${l.status} ${l.method} ${l.path}`).join(', ')}`);
  };
  const back = () => p.mouse.click(32, 32);

  await step('list', async () => { await p.goto('http://127.0.0.1:8415/app-demo/picklecourts/'); await wait(6000); await p.screenshot({ path: 'pc-tour-list.png' }); });
  await step('cottonwood', () => p.getByText('Cottonwood Court House').first().click());
  await step('cottonwood tomorrow', () => p.getByText('Tmrw', { exact: true }).first().click());
  await step('back', back);
  await step('north canal', () => p.getByText('North Canal Pickle Hall').first().click());
  await step('back 2', back);
  await step('lanternfield', () => p.getByText('Lanternfield Paddle Club').first().click());
  await step('pick 6 pm', () => p.getByText('6:00 PM', { exact: true }).first().click());
  await step('book', () => p.getByText(/^(Book|Continue|Reserve)/).last().click());
  await step('checkout', async () => {
    await p.getByPlaceholder('First name').fill('Sam'); await p.getByPlaceholder('Last name').fill('Demo');
    await p.getByPlaceholder('you@example.com').first().fill('sam@example.com'); await p.getByPlaceholder('you@example.com').last().fill('sam@example.com');
    await p.getByPlaceholder('(555) 123-4567').fill('4055550123');
    await p.getByText('Continue to Payment').click(); await wait(4000);
    await p.screenshot({ path: 'pc-tour-confirmed.png' });
  });
  await step('book another', () => p.getByText('Book Another Court').click());
  fs.writeFileSync('pc-recordings.json', JSON.stringify(log));
  console.log('recorded', log.length, 'exchanges'); console.log('errors', errs.slice(0, 5));
  await b.close();

  // The assistant's side: the same tools Claude and ChatGPT call, on the same data.
  const tomorrow = new Date(Date.parse(DAY + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  let id = 0;
  const rpc = async (method, params) => {
    const r = await fetch(LOCAL + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const t = await r.text();
    return JSON.parse(t.slice(t.indexOf('{')));
  };
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'demo', version: '1' } });
  const tools = (await rpc('tools/list', {})).result.tools.map((t) => ({ name: t.name, title: t.title, description: t.description }));
  const calls = [];
  for (const [name, args] of [
    ['search_venues', { query: 'Oklahoma City' }],
    ['find_availability_by_venue', { venue: 'Lanternfield Paddle Club', date: tomorrow, start_time: '18:00', end_time: '20:00' }],
  ]) {
    const res = await rpc('tools/call', { name, arguments: args });
    calls.push({ name, arguments: args, result: res.result || res.error });
  }
  fs.writeFileSync('pc-mcp.json', JSON.stringify({ demo_date: DAY, tools, calls }, null, 1));
  console.log('mcp', tools.map((t) => t.name).join(', '), calls.map((c) => c.result && c.result.isError ? 'ERR' : 'ok').join(' '));
})();
