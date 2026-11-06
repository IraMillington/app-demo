// PickleCourts reads its route from the address bar and expects to sit at /app
// (its legacy prefix) or the site root. The demo serves it from
// /app-demo/picklecourts/, so before the app starts the frame's address is set
// to /app/, the same origin, without loading anything. Its files were exported
// with baseUrl /app-demo/picklecourts, so they still load from the real folder.
(function () {
  try { history.replaceState(history.state, '', '/app/' + location.search); } catch (e) {}
})();
