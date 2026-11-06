const { chromium } = require('playwright');
// Served under /app-demo/, the GitHub Pages path, which PickleCourts' router expects.
const SITE = 'http://127.0.0.1:8420/app-demo/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: process.env.TZID || 'America/Chicago' });
  const leaks = [];
  await ctx.route('https://health.tailc51c3c.ts.net/**', (r) => { leaks.push(r.request().url()); r.abort(); });
  // Google Maps is allowed (PickleCourts' map, with its key limited to the site);
  // the test aborts it, and the app falls back to its list as without a key.
  await ctx.route(/maps\.googleapis\.com/, (r) => r.abort());
  await ctx.route(/picklecourts/, (r) => {
    const u = r.request().url();
    if (/^http:\/\/127\.0\.0\.1:8420\//.test(u)) return r.continue();
    leaks.push(u); r.abort();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  // PickleCourts' map loader logs its retries when no-maps.js reports the script as failed; expected.
  p.on('console', (m) => { if (m.type() === 'error' && !/Google Maps script/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto(SITE);
  await p.waitForTimeout(6000);
  const h = p.frameLocator('#h-frame'), r = p.frameLocator('#r-frame'), c = p.frameLocator('#c-frame');
  // Across phones, in the order the page suggests: Claro sends its minutes by
  // itself, Health's habit shows them; Recipes saves a meal, Health logs it.
  await p.click('.tabs [data-tab="claro"]'); await p.waitForTimeout(800);
  await p.waitForTimeout(20000);
  await p.click('.tabs [data-tab="health"]'); await p.waitForTimeout(800);
  await h.locator('[role=tab][aria-label="Check-in"]').click(); await p.waitForTimeout(2000);
  const habit = await h.getByText(/13 of 10 min in Claro/).count();
  await p.click('.tabs [data-tab="recipes"]'); await p.waitForTimeout(800);
  await r.getByText('Cookbook', { exact: true }).last().click(); await p.waitForTimeout(1500);
  await r.getByText('Instant Pot Chicken Tikka Masala').first().click(); await p.waitForTimeout(3000);
  await r.getByText('Save as a meal', { exact: true }).last().click(); await p.waitForTimeout(2000);
  await p.screenshot({ path: 's-r.png' });
  await p.click('.tabs [data-tab="health"]'); await p.waitForTimeout(800);
  await h.locator('[role=tab][aria-label="Food"]').click(); await p.waitForTimeout(1500);
  await h.locator('[aria-label^="Add food to Dinner"]').last().click(); await p.waitForTimeout(2500);
  await h.getByText('Instant Pot Chicken Tikka Masala').first().click(); await p.waitForTimeout(2500);
  const logged = await h.getByText('Saved meal · 23 foods').count();
  console.log('cross habit', habit > 0, 'meal', logged > 0, 'ticked', await p.locator('#x-try li.done').count());
  await p.screenshot({ path: 's-1.png' });
  await h.locator('[aria-label="AI estimate from a photo for Dinner"]').click(); await p.waitForTimeout(1200);
  await h.getByText('Photo library', { exact: true }).last().click(); await p.waitForTimeout(600);
  await h.locator('[data-demo-photo="tacos"]').click(); await h.locator('[data-demo-photo="tacosSide"]').click();
  await p.screenshot({ path: 's-2.png' });
  await h.getByText(/^Add( \(\d\))?$/).click(); await p.waitForTimeout(1000);
  await h.getByText('Estimate nutrition', { exact: true }).last().click(); await p.waitForTimeout(3000);
  await p.screenshot({ path: 's-3.png' });
  await h.getByText(/^Log to /).last().click(); await p.waitForTimeout(2500);
  await h.locator('[aria-label="Add one Glass, 8 ounces"]').click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: 's-4.png' });
  await h.locator('[role=tab][aria-label="Food"]').click().catch(() => {});
  await h.getByText('Settings', { exact: true }).last().click(); await p.waitForTimeout(1500);
  await h.getByText('Lactose intolerance', { exact: true }).first().scrollIntoViewIfNeeded();
  await h.getByText('Lactose intolerance', { exact: true }).first().click(); await p.waitForTimeout(1500);
  await h.getByText('Log', { exact: true }).last().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: 's-6.png' });
  await p.click('.tabs [data-tab="claro"]'); await p.waitForTimeout(800); await p.waitForTimeout(1000);
  await p.screenshot({ path: 's-5.png' });
  // PickleCourts: browse, book with mock payment, and the tool transcript renders.
  const pc = p.frameLocator('#p-frame');
  await p.click('.tabs [data-tab="picklecourts"]'); await p.waitForTimeout(800); await p.waitForTimeout(2500);
  await pc.getByText('Cottonwood Court House').first().click(); await p.waitForTimeout(2000);
  await pc.getByText('Tmrw', { exact: true }).first().click(); await p.waitForTimeout(1500);
  await (await p.locator('#p-frame').elementHandle()).contentFrame().then((f) => f.evaluate(() => history.back())); await p.waitForTimeout(2000);
  await pc.getByText('Lanternfield Paddle Club').first().click(); await p.waitForTimeout(2000);
  await pc.getByText('6:00 PM', { exact: true }).first().click(); await p.waitForTimeout(1500);
  await pc.getByText(/^(Book|Continue|Reserve)/).last().click(); await p.waitForTimeout(1500);
  await pc.getByPlaceholder('First name').fill('Sam'); await pc.getByPlaceholder('Last name').fill('Demo');
  await pc.getByPlaceholder('you@example.com').first().fill('sam@example.com'); await pc.getByPlaceholder('you@example.com').last().fill('sam@example.com');
  await pc.getByPlaceholder('(555) 123-4567').fill('4055550123');
  await pc.getByText('Continue to Payment').click(); await p.waitForTimeout(3000);
  const booked = await pc.getByText('Book Another Court').count();
  await p.screenshot({ path: 's-pc.png' });
  console.log('pc booked', booked > 0, 'ticked', await p.locator('#p-try li.done').count(), 'mcp', await p.locator('#pc-mcp table tr').count());
  console.log('progress', await p.locator('#h-progress').innerText());
  console.log('leaks', leaks, 'errs', errs.slice(0, 8));
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mp = await m.newPage(); await mp.goto(SITE); await mp.waitForTimeout(5000);
  console.log('mobile overflow', await mp.evaluate(() => document.documentElement.scrollWidth));
  await mp.click('.tabs [data-tab="health"]'); await mp.waitForTimeout(1500); await mp.screenshot({ path: 's-m.png' });
  await b.close();
})();
