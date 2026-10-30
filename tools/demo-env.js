// Demo environment for the app web builds. Loaded before the app bundle; the
// app's own code is unchanged. It pins "today" to the day the demo data was
// recorded (so dates line up for every visitor) and fills in the saved state a
// signed-in phone would already have.
(function () {
  var DAY = window.__DEMO_DAY || [2026, 9, 30];
  var RealDate = Date;
  var target = new RealDate(DAY[0], DAY[1], DAY[2], 11, 30).getTime();
  var offset = target - RealDate.now();
  function DemoDate() {
    var a = Array.prototype.slice.call(arguments);
    if (!(this instanceof DemoDate)) return new RealDate(RealDate.now() + offset).toString();
    var d = a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(RealDate.now() + offset);
    Object.setPrototypeOf(d, DemoDate.prototype);
    return d;
  }
  DemoDate.prototype = Object.create(RealDate.prototype, { constructor: { value: DemoDate } });
  DemoDate.now = function () { return RealDate.now() + offset; };
  DemoDate.parse = RealDate.parse;
  DemoDate.UTC = RealDate.UTC;
  window.Date = DemoDate;

  try {
    var seed = window.__DEMO_STORAGE || {};
    Object.keys(seed).forEach(function (k) { if (localStorage.getItem(k) == null) localStorage.setItem(k, seed[k]); });
  } catch (e) {}


  // A fingertip instead of the mouse pointer, and a ripple where you tap,
  // so the phone feels like a touch screen.
  var dot = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="15" fill="rgba(120,120,120,0.28)" stroke="rgba(255,255,255,0.9)" stroke-width="2"/></svg>');
  function touchLook() {
    var style = document.createElement('style');
    style.textContent = 'html, body, * { cursor: url("' + dot + '") 18 18, pointer !important; }' +
      '.demo-tap { position: fixed; z-index: 2147483647; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; background: rgba(120,120,120,.35); pointer-events: none; animation: demo-tap .35s ease-out forwards; }' +
      '@keyframes demo-tap { from { transform: scale(.6); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }' +
      '@media (prefers-reduced-motion: reduce) { .demo-tap { display: none; } }';
    document.head.appendChild(style);
    document.addEventListener('pointerdown', function (e) {
      var t = document.createElement('div');
      t.className = 'demo-tap';
      t.style.left = e.clientX + 'px';
      t.style.top = e.clientY + 'px';
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 400);
    }, true);
  }
  if (document.head) touchLook(); else document.addEventListener('DOMContentLoaded', touchLook);

  // Dragging with the mouse scrolls, as a finger would, with a little
  // momentum. A drag does not count as a tap on whatever it started on.
  function scroller(el, horizontal) {
    for (; el && el !== document.documentElement; el = el.parentElement) {
      var cs = getComputedStyle(el);
      var ov = horizontal ? cs.overflowX : cs.overflowY;
      if (!/auto|scroll/.test(ov)) continue;
      if (horizontal ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1) return el;
    }
    return document.scrollingElement;
  }
  var drag = null, swallowClick = false;
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    drag = { x: e.clientX, y: e.clientY, target: e.target, el: null, moved: false, vx: 0, vy: 0, t: performance.now() };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.moved = true;
      drag.horizontal = Math.abs(dx) > Math.abs(dy);
      drag.el = scroller(drag.target, drag.horizontal);
      document.documentElement.style.userSelect = 'none';
    }
    var now = performance.now(), dt = Math.max(1, now - drag.t);
    if (drag.horizontal) { drag.el.scrollLeft -= dx; drag.vx = dx / dt; }
    else { drag.el.scrollTop -= dy; drag.vy = dy / dt; }
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
    e.preventDefault();
  }, true);
  document.addEventListener('pointerup', function () {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved) return;
    document.documentElement.style.userSelect = '';
    swallowClick = true;
    setTimeout(function () { swallowClick = false; }, 0);
    if (performance.now() - d.t > 80) return;
    var v = Math.max(-40, Math.min(40, (d.horizontal ? d.vx : d.vy) * 16));
    (function glide() {
      if (Math.abs(v) < 0.5) return;
      if (d.horizontal) d.el.scrollLeft -= v; else d.el.scrollTop -= v;
      v *= 0.94;
      requestAnimationFrame(glide);
    })();
  }, true);
  document.addEventListener('click', function (e) {
    if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
