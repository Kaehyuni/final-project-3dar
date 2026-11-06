document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
const video = document.querySelector('#banner-video');
if (video) {
  video.autoplay = true;
  video.defaultMuted = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  let starting = false;
  async function keepPlaying() {
    if (starting || !video.paused || video.error) return;
    starting = true;
    try {
      await video.play();
    } catch {
      // Retry on the next playback event or user interaction if autoplay is blocked.
    } finally {
      starting = false;
    }
  }
  for (const event of ['loadeddata', 'canplay', 'ended']) {
    video.addEventListener(event, keepPlaying);
  }
  window.addEventListener('pageshow', keepPlaying);
  window.addEventListener('focus', keepPlaying);
  document.addEventListener('visibilitychange', keepPlaying);
  document.addEventListener('pointerdown', keepPlaying, { passive: true });
  document.addEventListener('keydown', keepPlaying);
  window.setInterval(keepPlaying, 2000);
  keepPlaying();
}
