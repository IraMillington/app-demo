// Demo replay layer for the Health, Recipes and Claro web builds. Loaded before
// each app's bundle; the apps' own code is unchanged. It answers the app's API calls from
// recordings.json: the responses the real server gave when a scripted tour drove
// these same builds against invented data. Each change you make (log water, rate a
// meal, ...) moves the replay to the server's state right after that change. The
// three phones share one recording and one position (sessionStorage, same
// origin), so a meal saved in Recipes or minutes sent from Claro show up in Health.
(function () {
  var HOST = window.__DEMO_API_HOST;
  var rec = null;
  var realFetch = window.fetch.bind(window);
  var loading = realFetch(new URL(window.__DEMO_RECORDINGS || 'recordings.json', document.baseURI).href).then(function (r) { return r.json(); }).then(function (j) { rec = j; });
  // pos: index of the last recorded change the viewer has made; used: changes already replayed.
  var KEY = window.__DEMO_REPLAY_KEY || 'demo_replay';
  function load() { try { var v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (v) return v; } catch (e) {} return { pos: -1, used: {} }; }
  function save(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  var state = load();
  var STATELESS = /^\/(api\/(estimate$|describe|foods\/|accounts\/|profiles$|events$|recipes\/app\/(status|foods\/|preview))|recipes\/api\/(accounts\/|users\/search))/;
  var ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

  function pathOnly(p) { return p.split('?')[0]; }
  function isWrite(e) { return e.method !== 'GET' && !STATELESS.test(pathOnly(e.path)); }
  function nextWriteAfter(i) {
    for (var j = i + 1; j < rec.length; j++) if (isWrite(rec[j])) return j;
    return rec.length;
  }
  function pickRead(method, path) {
    var exact = [], loose = [];
    rec.forEach(function (e, i) {
      if (e.method !== method) return;
      if (e.path === path) exact.push(i); else if (pathOnly(e.path) === pathOnly(path)) loose.push(i);
    });
    var c = exact.length ? exact : loose;
    if (!c.length) return null;
    var limit = nextWriteAfter(state.pos);
    var before = c.filter(function (i) { return i < limit; });
    return before.length ? before[before.length - 1] : c[0];
  }
  function pickWrite(method, path, body) {
    var best = null;
    for (var i = 0; i < rec.length; i++) {
      var e = rec[i];
      if (state.used[i] || e.method !== method || pathOnly(e.path) !== pathOnly(path)) continue;
      if (best === null) best = i;
      if (body && e.reqBody === body) { best = i; break; }
    }
    return best;
  }
  // Settings the viewer changes (conditions, features, tracking) are kept here
  // and laid over the recorded profile, the way the server would store them.
  var prefs = {};
  var GUT = ['PCOS', 'endometriosis', 'lactose_intolerance', 'GI_undiagnosed', 'IBS', 'IBD', 'celiac', 'GERD'];
  function savePrefs(body) {
    var change = {};
    try { change = JSON.parse(body || '{}'); } catch (e) {}
    Object.keys(change).forEach(function (k) {
      prefs[k] = k === 'features' ? Object.assign({}, prefs.features || {}, change.features) : change[k];
    });
  }
  function withPrefs(e) {
    if (pathOnly(e.path) !== '/api/profiles' || !Object.keys(prefs).length) return e;
    var me = (window.__DEMO_STORAGE || {}).profile;
    var list = JSON.parse(e.body).map(function (p) {
      if (p.id !== me) return p;
      var q = Object.assign({}, p);
      Object.keys(prefs).forEach(function (k) { q[k] = k === 'features' ? Object.assign({}, p.features || {}, prefs.features) : prefs[k]; });
      if (prefs.conditions) {
        q.gut_tracking = prefs.conditions.some(function (c) { return GUT.indexOf(c) >= 0; });
        if (prefs.track_blood_pressure === undefined) q.track_blood_pressure = prefs.conditions.indexOf('hypertension') >= 0;
      }
      return q;
    });
    return { status: e.status, body: JSON.stringify(list) };
  }
  // Habits the viewer ticks are kept too and laid over every habits read, so a
  // tick stays ticked even when the tour never recorded that habit's toggle.
  function habitTicks() { try { return JSON.parse(sessionStorage.getItem(KEY + '_habits') || '{}'); } catch (e) { return {}; } }
  function saveTick(body) {
    try {
      var b = JSON.parse(body || '{}'), t = habitTicks();
      if (b.habit_id && b.date) { t[b.date + '|' + b.habit_id] = !!b.completed; sessionStorage.setItem(KEY + '_habits', JSON.stringify(t)); }
    } catch (e) {}
  }
  function withTicks(e, path) {
    var m = /^\/api\/habits\/(\d{4}-\d{2}-\d{2})$/.exec(pathOnly(path));
    var t = habitTicks();
    if (!m || !Object.keys(t).length) return e;
    try {
      var j = JSON.parse(e.body);
      (j.habits || []).forEach(function (h) { var k = m[1] + '|' + h.id; if (k in t) h.completed = t[k]; });
      return { status: e.status, body: JSON.stringify(j) };
    } catch (x) { return e; }
  }
  function picked() { return (window.__demoPicked || []).slice(-4); }
  function estimateKey(ids) {
    var n = {};
    ids.forEach(function (id) { var meal = id.replace(/Side$/, ''); n[meal] = (n[meal] || 0) + 1; });
    return Object.keys(n).map(function (m) { return m + '-' + (m === 'tacos' || m === 'bowl' ? Math.min(n[m], 2) : 1); }).join('+');
  }
  function tell(msg) { try { if (window.parent !== window) window.parent.postMessage(Object.assign({ demo: window.__DEMO_APP || 'health' }, msg), '*'); } catch (e) {} }
  function respond(e) {
    return new Response(e.body, { status: e.status, headers: { 'Content-Type': 'application/json' } });
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    if (!url || url.indexOf(HOST) !== 0) return realFetch(input, init);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var path = url.slice(HOST.length);
    var body = init && typeof init.body === 'string' ? init.body : null;
    return loading.then(function () {
      state = load();
      return new Promise(function (res) { setTimeout(res, 120 + Math.random() * 180); });
    }).then(function () {
      var i;
      if (pathOnly(path) === '/api/estimate') {
        var key = estimateKey(picked());
        window.__demoPicked = [];
        i = rec.findIndex(function (e) { return e.estimateKey === key; });
        if (i < 0) i = rec.findIndex(function (e) { return e.estimateKey; });
        tell({ kind: 'estimate', key: key });
        return new Promise(function (r) { setTimeout(r, 1400); }).then(function () { return respond(rec[i]); });
      }
      if (method === 'GET' || STATELESS.test(pathOnly(path))) {
        i = pickRead(method, path);
        tell({ kind: 'read', path: path });
        if (i === null) return new Response(JSON.stringify({ detail: 'Not part of this demo' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        return respond(withTicks(withPrefs(rec[i]), path));
      }
      if (pathOnly(path) === '/api/profile/preferences') {
        savePrefs(body);
        tell({ kind: 'write', method: method, path: pathOnly(path), body: body });
        return new Response(JSON.stringify(prefs), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (pathOnly(path) === '/api/habits/toggle') saveTick(body);
      i = pickWrite(method, path, body);
      tell({ kind: 'write', method: method, path: pathOnly(path).replace(ID, ':id'), body: body });
      if (i === null) {
        // A change the recorded tour never made: answer like the last similar one, state unchanged.
        var shape = pathOnly(path).replace(ID, ':id');
        for (var j = rec.length - 1; j >= 0; j--) if (rec[j].method === method && pathOnly(rec[j].path).replace(ID, ':id') === shape) return respond(rec[j]);
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      state = load();
      state.used[i] = true;
      state.pos = Math.max(state.pos, i);
      save(state);
      return respond(rec[i]);
    });
  };
})();
