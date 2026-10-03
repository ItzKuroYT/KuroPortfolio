const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
function closeMenu() { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Open navigation'); }
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('open')) { closeMenu(); toggle.focus(); } });
document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
nav?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
matchMedia('(min-width:1001px)').addEventListener('change', closeMenu);
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: .05 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  // Never leave content hidden if observer fails to deliver after restoration.
  addEventListener('pageshow', () => document.querySelectorAll('.reveal').forEach(el => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('visible'); }));
}
let toastTimer;
export function toast(text) { const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'),3500); }
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard.'); }
  catch { toast('Copy is unavailable. Select the text and copy it manually.'); }
}
document.querySelectorAll('[data-copy]').forEach(el => el.addEventListener('click', () => copy(el.dataset.copy)));
const screenshotDialog = document.querySelector('#screenshot-dialog');
if (screenshotDialog) {
  const screenshotImage = document.querySelector('#screenshot-image');
  document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('#screenshot-title').textContent = button.dataset.previewTitle;
    screenshotImage.src = button.dataset.preview;
    screenshotImage.alt = `${button.dataset.previewTitle} — full website screenshot`;
    screenshotDialog.showModal();
    document.body.classList.add('preview-open');
  }));
  screenshotDialog.querySelector('.screenshot-close').addEventListener('click', () => screenshotDialog.close());
  screenshotDialog.addEventListener('click', event => {
    const bounds = screenshotDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) screenshotDialog.close();
  });
  screenshotDialog.addEventListener('close', () => document.body.classList.remove('preview-open'));
}
document.querySelector('#load-youtube')?.addEventListener('click', () => {
  const player = document.createElement('iframe');
  player.src = 'https://www.youtube-nocookie.com/embed/CA__y3VWQco?autoplay=1&list=PLqspCx7J_SFpbiSiFzLh7ehN4Dvj-uz_A';
  player.title = 'Kuro voice acting — YouTube Project'; player.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture'; player.allowFullscreen = true;
  document.querySelector('#youtube-preview').replaceChildren(player);
});
