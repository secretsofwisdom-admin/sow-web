
// Loader: wait for all resources
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if(loader){
    loader.style.opacity = '0';
    setTimeout(()=> loader.style.display='none', 1000);
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
