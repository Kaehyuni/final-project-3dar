document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
const video = document.querySelector('#banner-video');
const toggle = document.querySelector('#video-toggle');
if (video && toggle) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  toggle.hidden = false;
  function updateLabel() { toggle.textContent = video.paused ? 'Play banner' : 'Pause banner'; }
  video.addEventListener('play', updateLabel);
  video.addEventListener('pause', updateLabel);
  video.addEventListener('error', () => { toggle.hidden = true; });
  async function play() { try { await video.play(); } catch { updateLabel(); } }
  toggle.addEventListener('click', () => { if (video.paused) play(); else video.pause(); });
  motion.addEventListener('change', () => { if (motion.matches) video.pause(); });
  if (!motion.matches && !navigator.connection?.saveData) play();
}
