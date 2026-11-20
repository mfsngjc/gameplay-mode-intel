/* Serve the same Steam-hosted asset through independent HTTPS CDN endpoints. */
window.UGCCovers = (() => {
  'use strict';
  function urls(value) {
    let original;
    try { original = new URL(value); } catch { return []; }
    if (original.protocol !== 'https:' ||
        (original.hostname === 'fortnite.gg' && original.pathname.startsWith('/img/creative_placeholder'))) return [];
    const hosts = ['images.akamai.steamusercontent.com', 'steamuserimages-a.akamaihd.net', 'images.steamusercontent.com'];
    if (hosts.includes(original.hostname) && /^\/ugc\/\d+\/[a-f0-9]{40}\/?$/i.test(original.pathname)) {
      return hosts.map(host => 'https://' + host + original.pathname + original.search);
    }
    return [original.href];
  }

  document.querySelector('#ugcSection').addEventListener('error', event => {
    const image = event.target;
    const source = image.getAttribute?.('data-ugc-cover');
    if (!source) return;
    const candidates = urls(source);
    const index = candidates.indexOf(image.src);
    if (index >= 0 && candidates[index + 1]) {
      image.src = candidates[index + 1];
      return;
    }
    const fallback = document.createElement('span');
    fallback.className = image.classList.contains('ugc-board-cover') ? 'ugc-board-cover-missing' : 'ugc-catalog-cover-fallback';
    fallback.textContent = '作品图暂不可用';
    image.replaceWith(fallback);
  }, true);

  return { url: value => urls(value)[0] || '' };
})();
