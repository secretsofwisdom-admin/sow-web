/* Palette switching.
 *
 * Deliberately a separate file from lang-switcher.js. The language machinery
 * is delicate and load-bearing — it caches English originals, rewrites
 * innerHTML, and owns the iframe URL contract — and the only thing the two
 * genuinely share is the single postMessage listener, which stays over there
 * so there is one origin check rather than two.
 *
 * This file runs after first paint. The palette itself is applied earlier, by
 * the small synchronous script in each page's <head>: a deferred script runs
 * after parse, which is far too late to stop a flash of the wrong ground.
 * Everything here is the part that can afford to wait — wiring the select,
 * persisting a choice, telling the calculators.
 */
(function () {
  var STORAGE_KEY = 'sow-theme';
  var THEMES = ['imperial', 'lifted', 'light'];
  var DEFAULT = 'imperial';

  function current() {
    try {
      var t = localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(t) === -1 ? DEFAULT : t;
    } catch (e) {
      // Safari private mode throws on localStorage.
      return DEFAULT;
    }
  }

  /* The default lives in the bare :root, so it is the *absence* of the
     attribute, not a value of it. Setting data-theme="imperial" would work
     but leaves the DOM claiming a theme the stylesheet has no block for. */
  function apply(theme) {
    if (theme === DEFAULT) {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
    document.querySelectorAll('.theme-select').forEach(function (sel) {
      if (sel.value !== theme) sel.value = theme;
    });
  }

  function switchTo(theme) {
    if (THEMES.indexOf(theme) === -1) return;
    if (theme === current()) {
      // Still re-apply: this is also the path the message listener uses when
      // a calculator announces a palette the store already agrees with, and
      // the select may be out of sync.
      apply(theme);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* Choice will not survive the page, but the page still turns over. */
    }
    apply(theme);
    if (window.sowPostCalculatorTheme) window.sowPostCalculatorTheme(theme);
  }

  window.sowSwitchTheme = switchTo;
  window.sowCurrentTheme = current;

  function init() {
    document.querySelectorAll('.theme-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        switchTo(this.value);
      });
    });
    // The <head> script already set the attribute; this syncs the select,
    // which does not exist yet at that point.
    apply(current());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
