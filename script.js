
// Loader: wait for all resources
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if(loader){
    loader.style.opacity = '0';
    setTimeout(()=> loader.style.display='none', 1000);
  }
});

// Expandable card handler (posts + services)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.post-card-header, .svc-card-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking a CTA link inside the expanded body
      if (e.target.closest('.svc-card-body a.btn-cta, .post-card-body a')) return;
      const card = header.closest('.post-card, .svc-card');
      const wasExpanded = card.classList.contains('expanded');
      card.classList.toggle('expanded');
      header.setAttribute('aria-expanded', !wasExpanded);
      if (wasExpanded) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        header.click();
      }
    });
  });
});

// The current page's menu link (2026-11-09). Marked here rather than in the
// markup because the eleven menus must stay byte-identical
// (scripts/check_theme_invariants.py, check 1). Cloudflare serves pages
// without ".html" too, and "/" is the home page, so both are normalised.
document.addEventListener('DOMContentLoaded', () => {
  const page = (p) => {
    let name = p.split('/').pop() || 'index';
    name = name.replace(/\.html$/, '');
    return name === '' ? 'index' : name;
  };
  const here = page(location.pathname);
  document.querySelectorAll('nav a[href]:not(.nav-logo)').forEach(link => {
    const href = link.getAttribute('href');
    if (/^[a-z]+:/i.test(href)) return; // external links (YouTube)
    if (page(href.split(/[?#]/)[0]) === here) link.setAttribute('aria-current', 'page');
  });
});

// Mobile hamburger navigation
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close the menu after tapping any link
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
});

// Fade-up: init as soon as DOM is ready (don't wait for images)
document.addEventListener('DOMContentLoaded', () => {
  const observers = document.querySelectorAll('.fade-up');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('visible'); }
    });
  }, {threshold: 0.1});
  observers.forEach(el => observer.observe(el));
});
