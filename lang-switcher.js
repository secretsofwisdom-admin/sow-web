(function () {
  const STORAGE_KEY = 'sow-lang';
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
  function syncCalculatorLanguage(lang) {
    document.querySelectorAll('iframe[data-calc-src]').forEach(function (frame) {
      var base = frame.getAttribute('data-calc-src');
      var wanted = base + (lang === 'ru' ? '?lang=ru' : '');
      // Compared against the attribute, not frame.src — the property is
      // resolved to an absolute URL and would never match.
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

  function currentLang() {
    return localStorage.getItem(STORAGE_KEY) === 'ru' ? 'ru' : 'en';
  }

  // A switch made while the app is still booting would arrive before its
  // listener exists. Each calculator announces itself when it is ready, and
  // gets told the language as it stands at that moment.
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== 'sow-calc' || data.type !== 'ready') return;
    if (event.source) {
      event.source.postMessage(
        { source: 'sow', type: 'lang', lang: currentLang() },
        window.location.origin
      );
    }
  });

  function switchTo(lang) {
    if (lang === 'ru') {
      localStorage.setItem(STORAGE_KEY, 'ru');
      if (translations) {
        applyTranslations(translations);
      } else {
        fetchAndApply();
      }
    } else {
      localStorage.setItem(STORAGE_KEY, 'en');
      restoreEnglish();
    }
    postCalculatorLanguage(lang);
  }

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
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru') {
      fetchAndApply();
    }
    // On the calculator page, before the app has loaded — a src set here is
    // the app's first load, so it costs no extra fetch.
    syncCalculatorLanguage(saved === 'ru' ? 'ru' : 'en');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
