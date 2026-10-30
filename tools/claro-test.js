const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const seed = JSON.parse(fs.readFileSync('claro-seed.json', 'utf8'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago' });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8411/'); await p.waitForTimeout(3000);
  await p.screenshot({ path: 'c-today.png' });
  for (const t of ['Practice', 'Phrases', 'Progress']) { await p.getByText(t, { exact: true }).last().click(); await p.waitForTimeout(1200); await p.screenshot({ path: `c-${t}.png` }); }
  console.log(errs);
  await b.close();
})();
