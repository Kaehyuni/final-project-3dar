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

// Navigation opens a separate browsing context; local controls stay in the lesson.
function prepareLinks(root=document){
  root.querySelectorAll('a[href]').forEach(link=>{
    const href=link.getAttribute('href');
    if(!href || href.startsWith('#') || /^(mailto:|tel:|sms:)/.test(href)) return;
    link.target='_blank';link.rel='noopener noreferrer';
    const name=link.getAttribute('aria-label');if(name&&!name.includes('opens in a new tab'))link.setAttribute('aria-label',name+' (opens in a new tab)');
    if(!link.querySelector('.new-tab-note')){
      const note=document.createElement('span');note.className='new-tab-note sr-only';note.textContent=' (opens in a new tab)';link.append(note);
    }
  });
}
prepareLinks();
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches?.('a[href]'))prepareLinks(node.parentNode);else prepareLinks(node)}}).observe(document.body,{childList:true,subtree:true});
import('./js/bridgeassist.js').catch(()=>{
 const note=document.createElement('p');note.className='small';note.textContent='BridgeAssist could not load. The models and handouts remain available.';document.querySelector('main')?.append(note);
});
