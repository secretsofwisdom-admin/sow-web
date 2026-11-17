(function () {
  const STORAGE_KEY = 'sow-lang';
  // Read here as well as in theme-switcher.js. Deliberate: the calculator URL
  // carries both settings, so this file needs the theme at cold start, and
  // reading the store directly avoids a load-order dependency between the two
  // scripts for a single string.
  const THEME_KEY = 'sow-theme';
  const THEMES = ['imperial', 'light'];
  let translations = null;
  var originals = {};       // key → original textContent
  var originalsHtml = {};   // key → original innerHTML
  var originalBrand = {};   // element index → original innerHTML

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => {
      if (o == null) return undefined;
      const m = k.match(/^(.+)\[(\d+)]$/);
      if (m) return (o[m[1]] || [])[parseInt(m[2], 10)];
      return o[k];
    }, obj);
  }

  function saveOriginals() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!(key in originals)) originals[key] = el.textContent;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!(key in originalsHtml)) originalsHtml[key] = el.innerHTML;
    });
    document.querySelectorAll('[data-i18n-brand]').forEach(function (el, i) {
      if (!(i in originalBrand)) originalBrand[i] = el.innerHTML;
    });
  }

  function restoreEnglish() {
    document.documentElement.lang = 'en';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key in originals) el.textContent = originals[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (key in originalsHtml) el.innerHTML = originalsHtml[key];
    });
    document.querySelectorAll('[data-i18n-brand]').forEach(function (el, i) {
      if (i in originalBrand) el.innerHTML = originalBrand[i];
    });

    // Reset form text
    window.sowFormText = null;

    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.value = 'en';
    });
  }

  function applyTranslations(data) {
    translations = data;

    // Save English originals before first translation
    saveOriginals();

    // Set lang attribute
    document.documentElement.lang = 'ru';

    // Swap text for data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = getNestedValue(data, el.getAttribute('data-i18n'));
      if (val !== undefined) el.textContent = val;
    });

    // Swap HTML for data-i18n-html elements
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var val = getNestedValue(data, el.getAttribute('data-i18n-html'));
      if (val !== undefined) el.innerHTML = val;
    });

    // Brand name: show stacked EN + RU
    document.querySelectorAll('[data-i18n-brand]').forEach(function (el) {
      el.innerHTML =
        '<span class="brand-en">' + data.brand.name + '</span>' +
        '<span class="brand-ru">' + data.brand.nameRu + '</span>';
    });

    // Update form text object for contact page
    if (data.contact) {
      window.sowFormText = {
        send: data.contact.btnSend,
        sending: data.contact.btnSending,
        error: data.contact.errorFailed
      };
    }

    // Update dropdown selection
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.value = 'ru';
    });
  }

  function fetchAndApply() {
    // Determine base path for lang file
    var script = document.querySelector('script[src*="lang-switcher"]');
    var base = '';
    if (script) {
      var src = script.getAttribute('src');
      var idx = src.lastIndexOf('/');
      if (idx !== -1) base = src.substring(0, idx + 1);
    }

    fetch(base + 'lang/ru.json')
      .then(function (r) { return r.json(); })
      .then(applyTranslations)
      .catch(function () { /* silently fall back to English */ });
  }

  // Both calculators are Flutter apps in their own documents, so none of the
  // [data-i18n] machinery above can reach them. They speak both languages
  // themselves and read ?lang= at startup.
  //
  // Two paths, and the split matters. The ?lang= URL is the *cold start* only:
  // setting an iframe's src reloads the document, which restarts the Flutter
  // app and throws away everything the visitor has typed. A switch made after
  // the app is running goes over postMessage instead, so a half-filled birth
  // form survives EN <-> RU. (It used to reload here, on the reasoning that a
  // reload needs no listener inside the app. It also silently emptied the
  // form's state while the browser restored the visible text, which left the
  // Cast button dead with every field apparently filled.)
  //
  // Driven by data-calc-src rather than a hard-coded id and path, so a third
  // calculator is a markup change and not a code change here.
  // ONE function builds the whole query, and it must stay that way.
  //
  // Both settings share a single query string. A parallel syncCalculatorTheme()
  // that also set src — the obvious shape, one function per setting — would
  // each build a *complete* URL from its own parameter, so whichever ran second
  // would erase the first. Cold-start language would stop working and nothing
  // would look wrong in either function on its own.
  function calcUrl(base, lang, theme) {
    var q = [];
    if (lang === 'ru') q.push('lang=ru');
    // Omitted for the default, so bookmarks and the common path stay exactly
    // the URL this iframe has always been given.
    if (theme && theme !== 'imperial') q.push('theme=' + theme);
    return base + (q.length ? '?' + q.join('&') : '');
  }

  function syncCalculatorUrl(lang, theme) {
    document.querySelectorAll('iframe[data-calc-src]').forEach(function (frame) {
      var wanted = calcUrl(frame.getAttribute('data-calc-src'), lang, theme);
      // Compared against the attribute, not frame.src — the property is
      // resolved to an absolute URL and would never match, so every call
      // would rewrite src and reload the app.
      if (frame.getAttribute('src') !== wanted) frame.setAttribute('src', wanted);
    });
  }

  function postCalculatorLanguage(lang) {
    document.querySelectorAll('iframe[data-calc-src]').forEach(function (frame) {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage(
          { source: 'sow', type: 'lang', lang: lang },
          window.location.origin
        );
      }
    });
  }

  // Russian copies of the public pages live under /ru/ (2026-11-16,
  // scripts/build_ru.py), so that search engines can read the Russian text.
  // On those pages the address decides the language, not the stored choice.
  function pathLang() {
    return /^\/ru(\/|$)/.test(window.location.pathname) ? 'ru' : 'en';
  }

  // The same page in the other language, if there is one: pages that exist in
  // both carry <link rel="alternate" hreflang>. Only the path is taken from
  // it, so the mirror, pages.dev and a local server stay on their own origin.
  function alternatePath(lang) {
    var link = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (!link) return null;
    try {
      return new URL(link.getAttribute('href'), window.location.href).pathname;
    } catch (e) {
      return null;
    }
  }

  // Query and hash go along: ?profile=, ?new=1 and #calendar belong to the
  // calculator and must survive the move.
  function goToAlternate(lang, replace) {
    var path = alternatePath(lang);
    if (!path || path === window.location.pathname) return false;
    var url = path + window.location.search + window.location.hash;
    if (replace) window.location.replace(url);
    else window.location.assign(url);
    return true;
  }

  function storeLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang === 'ru' ? 'ru' : 'en');
    } catch (e) {
      // localStorage throws in Safari private mode; the address still works.
    }
  }

  function currentLang() {
    if (pathLang() === 'ru') return 'ru';
    try {
      return localStorage.getItem(STORAGE_KEY) === 'ru' ? 'ru' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function currentTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return THEMES.indexOf(t) === -1 ? 'imperial' : t;
    } catch (e) {
      // localStorage throws in Safari private mode.
      return 'imperial';
    }
  }

  // A switch made while the app is still booting would arrive before its
  // listener exists. Each calculator announces itself when it is ready, and
  // gets told the language as it stands at that moment.
  //
  // One listener, one origin check. A second addEventListener for themes
  // would be a second place to forget that check, and it is the entire
  // security boundary here.
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== 'sow-calc') return;

    if (data.type === 'ready' && event.source) {
      // Two narrow messages rather than one combined {lang, theme}: the
      // deployed calculator bundles only understand {type:'lang'}, so a site
      // deploy landing before an app rebuild would break the *working*
      // language feature. One extra postMessage buys independent deploys.
      event.source.postMessage(
        { source: 'sow', type: 'lang', lang: currentLang() },
        window.location.origin
      );
      event.source.postMessage(
        { source: 'sow', type: 'theme', theme: currentTheme() },
        window.location.origin
      );
      return;
    }

    if (data.type === 'theme') {
      // The visitor picked a palette inside a calculator. Validate before
      // storing: the origin check makes the trust boundary "any document on
      // this origin", which includes both Flutter apps, and an unvalidated
      // write would persist a bad value and reflect it into <html data-theme>
      // on every later load.
      if (THEMES.indexOf(data.theme) === -1) return;
      // Echo guard. The broadcast below goes to every calculator iframe
      // including the one that sent this, so a no-op must not re-broadcast.
      if (data.theme === currentTheme()) return;
      if (window.sowSwitchTheme) window.sowSwitchTheme(data.theme);
    }
  });

  function switchTo(lang) {
    storeLang(lang);
    // A page that exists in both languages changes address instead of being
    // rewritten in place. This reloads a calculator; the BaZi app restores its
    // form and chart from the tab's sessionStorage, the astrology app starts
    // empty. Pages with no Russian copy (account, thank-you) still swap here.
    if (goToAlternate(lang, false)) return;
    if (lang === 'ru') {
      if (translations) {
        applyTranslations(translations);
      } else {
        fetchAndApply();
      }
    } else {
      restoreEnglish();
    }
    postCalculatorLanguage(lang);
  }

  // Exposed so theme-switcher.js can reach the iframes without duplicating
  // the [data-calc-src] contract.
  window.sowPostCalculatorTheme = function (theme) {
    document.querySelectorAll('iframe[data-calc-src]').forEach(function (frame) {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage(
          { source: 'sow', type: 'theme', theme: theme },
          window.location.origin
        );
      }
    });
  };

  // Expose for toggle buttons
  window.sowSwitchLang = switchTo;

  // On DOM ready, check saved preference
  function init() {
    // Attach change handler to language dropdown
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        switchTo(this.value);
      });
    });

    // Save English originals before any translation
    saveOriginals();

    // Auto-apply saved language
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      saved = null;
    }
    if (pathLang() === 'ru') {
      // The text is already Russian in the markup; applying the translations
      // again is harmless and also sets the brand lines and the form strings.
      storeLang('ru');
      saved = 'ru';
    } else if (saved === 'ru' && goToAlternate('ru', true)) {
      // A visitor who reads in Russian opened an English address that has a
      // Russian copy: send them there, so the menu keeps them on /ru/.
      return;
    }
    if (saved === 'ru') {
      fetchAndApply();
    }
    // On the calculator page, before the app has loaded — a src set here is
    // the app's first load, so it costs no extra fetch. Both settings go on
    // in one call; see calcUrl.
    syncCalculatorUrl(saved === 'ru' ? 'ru' : 'en', currentTheme());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
