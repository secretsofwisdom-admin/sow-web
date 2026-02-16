(function () {
  const STORAGE_KEY = 'sow-lang';
  let translations = null;

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => {
      if (o == null) return undefined;
      const m = k.match(/^(.+)\[(\d+)]$/);
      if (m) return (o[m[1]] || [])[parseInt(m[2], 10)];
      return o[k];
    }, obj);
  }

  function applyTranslations(data) {
    translations = data;

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

    // Mark active toggle
    document.querySelectorAll('.lang-toggle').forEach(function (wrap) {
      wrap.querySelector('[data-lang="en"]').classList.remove('active');
      wrap.querySelector('[data-lang="ru"]').classList.add('active');
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
      // Reload to restore original English HTML
      window.location.reload();
    }
  }

  // Expose for toggle buttons
  window.sowSwitchLang = switchTo;

  // On DOM ready, check saved preference
  function init() {
    // Attach click handlers to toggle buttons
    document.querySelectorAll('.lang-toggle [data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTo(this.getAttribute('data-lang'));
      });
    });

    // Auto-apply saved language
    if (localStorage.getItem(STORAGE_KEY) === 'ru') {
      fetchAndApply();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
