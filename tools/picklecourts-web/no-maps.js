// The demo has no Google Maps key, so the map script is never fetched: it is
// marked as not loadable and reported as failed, the way a blocked network
// would. The app then falls back to its venue list, as it does on a real phone
// without maps.
(function () {
  var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    configurable: true,
    get: function () { return desc.get.call(this); },
    set: function (v) {
      if (/maps\.googleapis\.com/.test(String(v))) {
        var el = this;
        el.type = 'text/plain';
        setTimeout(function () { el.dispatchEvent(new Event('error')); }, 50);
        return;
      }
      desc.set.call(this, v);
    },
  });
})();
