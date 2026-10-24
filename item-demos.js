/* Reviewed gameplay excerpts for the thematic item catalogue. */
const ItemDemos = (() => {
  'use strict';
  const bound = new WeakSet();
  const localVideo = value => typeof value === 'string' && /^assets\/tactical-demos\/[a-z0-9-]+\.mp4$/.test(value) ? value : '';
  const localPoster = value => typeof value === 'string' && /^assets\/tactical-demos\/[a-z0-9-]+\.jpg$/.test(value) ? value : '';
  const https = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const clips = entry => (Array.isArray(entry.clips) ? entry.clips : []).filter(clip => localVideo(clip.path) && localPoster(clip.posterPath) && https(clip.sourceUrl));
  function sourceLink(clip) {
    const url = new URL(clip.sourceUrl);
    if (Number.isFinite(clip.sourceStartSeconds)) url.searchParams.set('t', Math.floor(clip.sourceStartSeconds) + 's');
    return url.href;
  }
  function render(entry) {
    const rows = clips(entry);
    if (!rows.length) return '';
    return '<section class="detail-section item-demos" aria-label="演示短片"><h3>演示短片</h3>' + rows.map((clip, index) => {
      const title = entry.name + ' · ' + (clip.title || '操作演示');
      const id = 'item-demo-' + entry.id + '-' + index;
      return '<figure class="item-demo"><div class="item-demo-screen"><video id="' + escapeHtml(id) + '" data-item-demo controls playsinline muted preload="none" poster="' + escapeHtml(localPoster(clip.posterPath)) + '" width="' + clip.width + '" height="' + clip.height + '" aria-label="' + escapeHtml(title) + '"><source src="' + escapeHtml(localVideo(clip.path)) + '" type="video/mp4">当前浏览器无法播放这段短片，请打开原视频查看。</video><p class="item-demo-error" role="status" hidden>短片暂时无法播放，可以打开下方原视频查看。</p></div>' +
        '<div class="item-demo-tools" role="group" aria-label="短片播放设置"><button type="button" data-demo-action="restart" aria-controls="' + escapeHtml(id) + '">重播</button><button type="button" data-demo-action="back" aria-controls="' + escapeHtml(id) + '">后退 1 秒</button><label>播放速度 <select data-demo-speed aria-controls="' + escapeHtml(id) + '"><option value="0.5">半速</option><option value="1" selected>正常</option><option value="1.5">1.5 倍</option></select></label><button type="button" data-demo-action="loop" aria-controls="' + escapeHtml(id) + '" aria-pressed="false">循环播放</button><span>' + Math.round(clip.durationSeconds * 10) / 10 + ' 秒 · 无声片段</span></div>' +
        '<figcaption><p>' + escapeHtml(clip.caption) + '</p><span>' + (clip.sourceType === 'official' ? '官方视频节选' : '社区视频节选') + ' · ' + (clip.footageKind === 'in_engine_demo' ? '游戏内演示' : '实机操作') + ' · ' + escapeHtml(clip.sourceName) + ' · ' + escapeHtml(clip.versionLabel) + '</span><a href="' + escapeHtml(sourceLink(clip)) + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml(clip.sourceTitle) + '">观看原视频与出处 ↗</a></figcaption></figure>';
    }).join('') + '</section>';
  }
  function stop(root) {
    root.querySelectorAll('video[data-item-demo]').forEach(video => { video.pause(); });
  }
  function bind(root) {
    if (bound.has(root)) return;
    bound.add(root);
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-demo-action]');
      if (!button) return;
      const video = button.closest('.item-demo')?.querySelector('video[data-item-demo]');
      if (!video) return;
      if (button.dataset.demoAction === 'loop') {
        video.loop = !video.loop;
        button.setAttribute('aria-pressed', String(video.loop));
      } else if (button.dataset.demoAction === 'back') {
        video.currentTime = Math.max(0, video.currentTime - 1);
      } else if (button.dataset.demoAction === 'restart') {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    });
    root.addEventListener('change', event => {
      if (!event.target.matches('[data-demo-speed]')) return;
      const video = event.target.closest('.item-demo')?.querySelector('video[data-item-demo]');
      const rate = Number(event.target.value);
      if (video && [0.5, 1, 1.5].includes(rate)) video.playbackRate = rate;
    });
    root.addEventListener('play', event => {
      if (!event.target.matches('video[data-item-demo]')) return;
      root.querySelectorAll('video[data-item-demo]').forEach(video => { if (video !== event.target) video.pause(); });
    }, true);
    root.addEventListener('error', event => {
      const figure = event.target.closest?.('.item-demo');
      if (!figure || !event.target.matches('video[data-item-demo],video[data-item-demo] source')) return;
      figure.querySelector('.item-demo-error').hidden = false;
    }, true);
    root.addEventListener('close', () => stop(root));
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(root); });
  }
  function markdown(entry) {
    return clips(entry).flatMap(clip => ['## 演示短片', '', '[' + entry.name + '：' + clip.title + '](' + new URL(clip.path, document.baseURI).href + ')', '', clip.caption, '',
      '- 素材来源：[' + clip.sourceName + '](' + sourceLink(clip) + ')', '- 素材性质：' + (clip.sourceType === 'official' ? '官方素材节选' : '社区视频节选'),
      '- 画面类型：' + (clip.footageKind === 'in_engine_demo' ? '游戏内演示' : '实机操作'), '- 演示范围：' + clip.versionLabel, '- 原片时间：' + clip.sourceStartSeconds + '–' + clip.sourceEndSeconds + ' 秒', '- 短片时长：' + clip.durationSeconds + ' 秒', '']);
  }
  return Object.freeze({ clips, render, markdown, bind, stop });
})();
