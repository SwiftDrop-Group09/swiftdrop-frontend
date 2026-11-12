/* global matchMedia, document */
// Apply the saved appearance before the page paints; React keeps it synchronized.
(() => {
  let theme = 'device';
  try {
    const saved = localStorage.getItem('swiftdrop-theme');
    if (['light', 'dark', 'device'].includes(saved)) theme = saved;
  } catch {
    /* Device appearance remains available without storage. */
  }
  const dark =
    theme === 'dark' ||
    (theme === 'device' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('scheme-dark', dark);
  document.documentElement.classList.toggle('scheme-light', !dark);
})();
