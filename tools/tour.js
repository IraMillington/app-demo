// Records the demo: drives the real Health web build against the real server
// (fake data) and saves every API exchange, in order, to recordings.json.
const fs = require('fs');
const { setup } = require('./rec.js');
const { makeRewrite, cannedKey } = require('./estimate-rewrite.js');
const ST = __dirname + '/stack', PH = __dirname + '/demo-photos';

(async () => {
  let page;
  let lastPicked = [];
  const rw = async (...a) => {
    const r = await makeRewrite(page, ST, PH)(...a);
    if (r) lastPicked = r.meta.picked;
    return r;
  };
  const { b, p, log, errs } = await setup({ rewrite: rw });
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

  // Writes on Today, in the order the page suggests trying them.
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
