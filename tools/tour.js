// Records the demo: drives the real Health web build against the real server
// (fake data) and saves every API exchange, in order, to recordings.json.
const fs = require('fs');
const { setup } = require('./rec.js');
const { makeRewrite, cannedKey } = require('./estimate-rewrite.js');
const { claroStorage, recipesStorage } = require('./demo-links.js');
const ST = __dirname + '/stack', PH = __dirname + '/demo-photos';

(async () => {
  let page;
  let lastPicked = [];
  const rw = async (...a) => {
    const r = await makeRewrite(page, ST, PH)(...a);
    if (r) lastPicked = r.meta.picked;
    return r;
  };
  const { b, ctx, p, log, errs } = await setup({ rewrite: rw });
  page = p;
  const wait = (ms = 1500) => p.waitForTimeout(ms);
  const step = async (name, fn) => {
    const n0 = log.length;
    try { await fn(); } catch (e) { console.log('STEP FAILED', name, e.message.split('\n')[0]); }
    await wait(1800);
    const dlg = p.locator('[role=alertdialog]');
    if (await dlg.count()) { console.log('   dialog:', (await dlg.first().innerText()).replace(/\n/g, ' | ')); await dlg.locator('button').last().click(); await wait(500); }
    console.log(`-- ${name}: ${log.slice(n0).map((l) => `${l.status} ${l.method} ${l.path}`).join(', ')}`);
  };
  const tab = (name) => p.locator(`[role=tab][aria-label^="${name}"], [role=link][aria-label^="${name}"]`).first().click().catch(() => p.getByText(name, { exact: true }).last().click());
  const back = () => p.locator('[aria-label$=", back"]').last().click();

  await p.goto('http://localhost:8412/');
  await wait(5000);

  // Reads: every screen once, before anything changes.
  await step('check-in', () => p.locator('[role=tab][aria-label="Check-in"]').click());
  await step('activity', () => p.locator('[role=tab][aria-label="Activity"]').click());
  await step('food', () => p.locator('[role=tab][aria-label="Food"]').click());
  await step('previous day', () => p.locator('[aria-label="Previous day"]').click());
  await step('previous day 2', () => p.locator('[aria-label="Previous day"]').click());
  await step('back to today', async () => { await p.locator('[aria-label="Next day"]').click(); await wait(800); await p.locator('[aria-label="Next day"]').click(); });
  await step('training', () => p.getByText('Training', { exact: true }).last().click());
  await step('report', () => p.getByText('Report', { exact: true }).last().click());
  for (const period of ['Weekly', 'Monthly', 'Overall', 'Daily']) await step('report ' + period, () => p.getByText(period, { exact: true }).last().click());
  await step('board', () => p.getByText('Board', { exact: true }).last().click());
  for (const period of ['Day', 'Month', 'Overall', 'Week']) await step('board ' + period, () => p.getByText(period, { exact: true }).last().click());
  await step('settings', () => p.getByText('Settings', { exact: true }).last().click());
  await step('log', () => p.getByText('Log', { exact: true }).last().click());
  await step('add food search', async () => {
    await p.locator('[aria-label^="Add food to Snacks"], [aria-label^="Add food"]').last().click().catch(() => p.getByText('＋ Add food').last().click());
    await wait(1500);
    const box = p.locator('input').last();
    await box.fill('greek yogurt'); await box.press('Enter'); await wait(4000);
  });
  await step('back from search', back);

  // Claro sends today's practice minutes (it also does this by itself shortly
  // after opening), which tick Health's "Spanish practice" habit. Recorded first
  // of the cross-app changes so the site's Claro can make it on its own.
  const cstep = async (name, fn) => { const n0 = log.length; try { await fn(); } catch (e) { console.log('STEP FAILED', name, e.message.split('\n')[0]); } await p.waitForTimeout(1800); console.log(`-- ${name}: ${log.slice(n0).map((l) => `${l.status} ${l.method} ${l.path}`).join(', ')}`); };
  const links = JSON.parse(fs.readFileSync(ST + '/links.json', 'utf8'));
  const cp = await ctx.newPage();
  cp.setDefaultTimeout(6000);
  cp.on('pageerror', (e) => errs.push('CLARO ' + e.message));
  await cp.addInitScript((st) => { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); }, claroStorage(__dirname + '/claro-seed.json', links.claro, process.env.DEMO_DATE));
  await cstep('claro open', async () => { await cp.goto('http://localhost:8414/'); await cp.waitForTimeout(4000); });
  await cstep('claro settings', () => cp.locator('[aria-label="Settings"]').click());
  await cstep('claro send now', async () => { await cp.getByText('Send now', { exact: true }).click(); await cp.waitForTimeout(2500); await cp.screenshot({ path: 'tour-claro-sent.png', fullPage: true }); });
  await p.bringToFront();
  await step('habit ticked by claro', async () => { await p.locator('[role=tab][aria-label="Check-in"]').click(); await wait(2500); await p.screenshot({ path: 'tour-claro-habit.png', fullPage: true }); });
  await cp.close();
  await step('food tab after claro', () => p.locator('[role=tab][aria-label="Food"]').click());


  // Photo estimates: every single photo, both two-angle pairs, and one mixed pair.
  const combos = [['tacos'], ['tacosSide'], ['latte'], ['bowl'], ['bowlSide'], ['pasta'], ['salad'], ['toast'], ['bowl', 'bowlSide'], ['tacos', 'latte'], ['tacos', 'tacosSide']];
  for (const combo of combos) {
    await step('estimate ' + combo.join('+'), async () => {
      await p.locator('[aria-label="AI estimate from a photo for Dinner"]').click(); await wait(1200);
      await p.evaluate(() => { window.__demoPicked = []; });
      await p.getByText('Photo library', { exact: true }).last().click(); await wait(600);
      for (const id of combo) await p.locator(`[data-demo-photo="${id}"]`).click();
      await p.getByText(/^Add( \(\d\))?$/).click(); await wait(1500);
      await p.getByText('Estimate nutrition', { exact: true }).last().click(); await wait(4500);
      const key = cannedKey(lastPicked);
      log[log.length - 1].estimateKey = key;
      if (combo.join('+') === 'tacos+tacosSide') {
        await p.getByText(/^Log to /).last().click(); await wait(2500);
      } else {
        await back();
      }
    });
  }

  // Recipes (signed in with Sam's Health login) saves a recipe to Health's saved
  // meals, which Health then logs.
  const rlogin = await (await fetch('http://127.0.0.1:8092/api/accounts/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo' }, body: JSON.stringify({ username: 'sam', password: 'demo-pass-123' }) })).json();
  const rp = await ctx.newPage();
  rp.setDefaultTimeout(6000);
  rp.on('pageerror', (e) => errs.push('RECIPES ' + e.message));
  await rp.addInitScript((st) => { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); }, recipesStorage(rlogin.token, rlogin.health_link_code));
  const rstep = async (name, fn) => { const n0 = log.length; try { await fn(); } catch (e) { console.log('STEP FAILED', name, e.message.split('\n')[0]); } await rp.waitForTimeout(1800); console.log(`-- ${name}: ${log.slice(n0).map((l) => `${l.status} ${l.method} ${l.path}`).join(', ')}`); };
  await rstep('recipes feed', async () => { await rp.goto('http://localhost:8413/'); await rp.waitForTimeout(5000); await rp.screenshot({ path: 'tour-recipes-feed.png' }); });
  await rstep('recipes quesabirria', () => rp.getByText('Instant Pot Quesabirria').first().click());
  await rstep('recipes back', () => rp.locator('[aria-label$=", back"], [aria-label="Go back"]').last().click());
  await rstep('recipes friends', () => rp.getByText('Friends', { exact: true }).last().click());
  await rstep('recipes cookbook', () => rp.getByText('Cookbook', { exact: true }).last().click());
  await rstep('recipes tikka', async () => { await rp.getByText('Instant Pot Chicken Tikka Masala').first().click(); await rp.waitForTimeout(4000); await rp.screenshot({ path: 'tour-recipes-tikka.png', fullPage: true }); });
  await rstep('recipes save as meal', () => rp.getByText('Save as a meal', { exact: true }).last().click());
  await rstep('recipes raita', async () => { await rp.locator('[aria-label$=", back"], [aria-label="Go back"]').last().click(); await rp.waitForTimeout(1500); await rp.getByText('Cucumber Mint Raita').first().click(); await rp.waitForTimeout(3000); });
  await rstep('recipes settings', async () => { await rp.locator('[aria-label$=", back"], [aria-label="Go back"]').last().click(); await rp.waitForTimeout(1000); await rp.getByText('Settings', { exact: true }).last().click(); });

  await rp.close();
  await p.bringToFront();
  await step('food tab for saved meal', () => p.locator('[role=tab][aria-label="Food"]').click());
  await step('add dinner with saved meal', async () => {
    await p.locator('[aria-label^="Add food to Dinner"]').last().click(); await wait(3000);
    await p.screenshot({ path: 'tour-saved-meal.png' });
    await p.getByText('Instant Pot Chicken Tikka Masala').first().click(); await wait(3000);
  });
  await step('diary after saved meal', async () => { await p.screenshot({ path: 'tour-diary-tikka.png', fullPage: true }); });

  // Writes on Today, in the order the page suggests trying them.
  await step('food tab again', () => p.locator('[role=tab][aria-label="Food"]').click());
  await step('water', () => p.locator('[aria-label="Add one Glass, 8 ounces"]').click());
  await step('skip snacks', () => p.getByText('Didn’t eat this meal').last().click());
  await step('check-in tab', () => p.locator('[role=tab][aria-label="Check-in"]').click());
  await step('habit', () => p.getByText('Stretch 10 minutes').first().click());
  await step('food tab', () => p.locator('[role=tab][aria-label="Food"]').click());
  await step('training', async () => { await p.getByText('Training', { exact: true }).last().click(); await wait(3000); await p.screenshot({ path: 'tour-training.png' }); });
  await step('training progress', async () => { await p.getByText('Progress', { exact: true }).first().click(); await wait(2500); await p.screenshot({ path: 'tour-progress.png' }); });
  await step('close progress', () => p.getByText('Close', { exact: true }).last().click());
  await step('training preview', async () => { await p.getByText('Preview', { exact: true }).first().click(); await wait(2500); await p.screenshot({ path: 'tour-preview.png' }); });
  await step('close preview', () => p.getByText(/^(Close|Done)$/).last().click());

  fs.writeFileSync('recordings.json', JSON.stringify(log, null, 0));
  console.log('recorded', log.length, 'exchanges');
  console.log('errors', errs.slice(0, 10));
  await p.screenshot({ path: 'tour-end.png' });
  await b.close();
})();
