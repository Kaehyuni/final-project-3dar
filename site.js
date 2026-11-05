document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
const video = document.querySelector('#banner-video');
if (video) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function updatePlayback() {
    if (motion.matches || navigator.connection?.saveData || document.hidden) {
      video.pause();
    } else {
      video.play().catch(() => { /* Keep the poster when autoplay is unavailable. */ });
    }
  }
  motion.addEventListener('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  updatePlayback();
}
