const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const fn = fs.readFileSync('photo-fn.js', 'utf8');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  fs.mkdirSync('demo-photos', { recursive: true });
  for (const kind of ['tacos', 'tacosSide', 'bowl', 'bowlSide', 'latte', 'pasta', 'salad', 'toast']) {
    const src = await p.evaluate(`(() => { ${fn}; return photo(${JSON.stringify(kind)}); })()`);
    await p.setContent(`<body style="margin:0"><img src="${src}" style="width:900px;height:900px;display:block"></body>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: `demo-photos/${kind}.jpg`, type: 'jpeg', quality: 82 });
  }
  await b.close();
})();
