// Recording only: on the web, React Native's {uri} form parts arrive as text, so the
// recorder rebuilds the upload with the picked demo photos and tells the demo
// server which canned model answer to use.
const fs = require('fs');
const MEAL = { tacos: 'tacos', tacosSide: 'tacos', bowl: 'bowl', bowlSide: 'bowl', latte: 'latte', pasta: 'pasta', salad: 'salad', toast: 'toast' };
function cannedKey(ids) {
  const counts = {};
  for (const id of ids) counts[MEAL[id]] = (counts[MEAL[id]] || 0) + 1;
  return Object.entries(counts).map(([m, n]) => `${m}-${m === 'tacos' || m === 'bowl' ? Math.min(n, 2) : 1}`).join('+');
}
function makeRewrite(page, stackDir, photosDir) {
  return async (req, url, body) => {
    if (!(req.method() === 'POST' && url.pathname === '/api/estimate')) return null;
    const ids = (await page.evaluate(() => window.__demoPicked || [])).slice(-4);
    await page.evaluate(() => { window.__demoPicked = []; });
    const text = body ? body.toString('latin1') : '';
    const fields = {};
    for (const m of text.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g)) if (m[1] !== 'images') fields[m[1]] = m[2];
    fs.writeFileSync(`${stackDir}/next_estimate.json`, JSON.stringify({ key: cannedKey(ids.length ? ids : ['toast']) }));
    const boundary = '----demo' + Date.now();
    const parts = [];
    for (const [i, id] of ids.entries()) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="meal-${i + 1}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`));
      parts.push(fs.readFileSync(`${photosDir}/${id}.jpg`));
      parts.push(Buffer.from('\r\n'));
    }
    for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    return { body: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, meta: { picked: ids } };
  };
}
module.exports = { makeRewrite, cannedKey };
