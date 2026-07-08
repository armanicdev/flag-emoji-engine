(function () {
  function getEl() {
    return document.getElementById('app-loading');
  }
  window.__FLAGOJI_LOADER_UNLOCKED = false;
  window.FlagojiHideLoader = function (opts) {
    var force = opts && opts.force;
    if (!force && !window.__FLAGOJI_LOADER_UNLOCKED) return;
    var el = getEl();
    if (!el || el.getAttribute('data-flagoji-loader') === 'done') return;
    el.setAttribute('data-flagoji-loader', 'done');
    var instant = opts && opts.instant;
    document.documentElement.style.overflow = '';
    if (instant) {
      el.remove();
      return;
    }
    var fadeMs = 700;
    el.style.willChange = 'opacity';
    el.style.transition = 'opacity ' + fadeMs + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.pointerEvents = 'none';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.opacity = '0';
      });
    });
    setTimeout(function () {
      el.style.willChange = '';
      el.remove();
    }, fadeMs + 120);
  };
  setTimeout(function () {
    var el = getEl();
    if (el && el.getAttribute('data-flagoji-loader') !== 'done' && typeof window.FlagojiHideLoader === 'function') {
      window.__FLAGOJI_LOADER_UNLOCKED = true;
      window.FlagojiHideLoader({ force: true, instant: false });
    }
  }, 15000);
})();
