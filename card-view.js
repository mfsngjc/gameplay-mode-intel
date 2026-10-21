/* One card-size preference shared by all public catalogues. */
window.CardView = (() => {
  'use strict';
  const storageKey = 'gameplay-card-size';
  const valid = value => value === 'large' || value === 'small';
  let size = 'small';
  try {
    const saved = localStorage.getItem(storageKey);
    if (valid(saved)) size = saved;
  } catch { /* The current session remains usable when storage is disabled. */ }
  const subscribers = new Set();
  function syncControls(root = document) {
    root.querySelectorAll('button[data-card-size]').forEach(button => {
      const selected = button.dataset.cardSize === size;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
    });
  }
  function apply(next, persist = true) {
    if (!valid(next)) return;
    const changed = next !== size;
    size = next;
    document.body.dataset.cardSize = size;
    if (persist) {
      try { localStorage.setItem(storageKey, size); } catch { /* Keep the in-memory preference. */ }
    }
    syncControls();
    if (changed) subscribers.forEach(callback => callback(size));
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-card-size]');
    if (button && !button.disabled) apply(button.dataset.cardSize);
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey && valid(event.newValue)) apply(event.newValue, false);
  });
  document.body.dataset.cardSize = size;
  syncControls();
  return Object.freeze({
    get: () => size,
    set: next => apply(next),
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    syncControls
  });
})();
