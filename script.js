
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
