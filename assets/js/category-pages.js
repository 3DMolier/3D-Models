(function(){
'use strict';

var loaded = false;

function loadMore() {
  if (loaded) return;
  loaded = true;
  var grid = document.getElementById('model-grid');
  var btn = document.getElementById('load-more-wrap');
  if (!grid || typeof EXTRA_MODELS === 'undefined') return;
  var LINK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  var color = (typeof COLOR !== 'undefined') ? COLOR : '#4F9EFF';
  var gradient = (typeof GRADIENT !== 'undefined') ? GRADIENT : '135deg,#f5f5f5 0%,#e5e5e5 100%';
  for (var i = 0; i < EXTRA_MODELS.length; i++) {
    var m = EXTRA_MODELS[i];
    var certHtml = m.cert === 'CM'
      ? '<span class="cert-badge">&#10003; CM</span>'
      : m.cert === 'SC'
        ? '<span class="cert-badge" style="background:rgba(124,58,237,0.1);border-color:rgba(124,58,237,0.25);color:#7C3AED;">SC</span>'
        : '';
    var imgHtml = m.img
      ? '<img src="' + m.img + '" alt="' + m.title.replace(/"/g,'&quot;') + '" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="img-placeholder" style="color:' + color + ';display:none;"><span style="font-size:28px;opacity:0.5;">&#128247;</span><span style="color:' + color + ';">' + m.cat + '</span></div>'
      : '<div class="img-placeholder" style="color:' + color + ';"><span style="font-size:28px;opacity:0.5;">&#128247;</span><span style="color:' + color + ';">' + m.cat + '</span></div>';
    var card = document.createElement('div');
    card.className = 'model-card card-glow';
    card.innerHTML = '<div class="img-wrap" style="height:180px;background:#f5f5f5;">' + imgHtml + '</div>'
      + '<div style="padding:16px;">'
      + '<div style="display:flex;align-items:start;justify-content:space-between;gap:8px;margin-bottom:10px;">'
      + '<h3 style="font-family:\'Open Sans\', sans-serif;font-size:14px;font-weight:700;color:#111111;line-height:1.3;letter-spacing:-0.01em;">' + m.title + '</h3>'
      + certHtml + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">'
      + '<span class="chip" style="font-size:11px;padding:3px 8px;color:#111111;">' + m.cat + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:#111111;margin-left:auto;">' + m.price + '</span>'
      + '</div>'
      + '<a href="' + m.url + '" target="_blank" rel="noopener" class="btn-ts" style="width:100%;justify-content:center;">'
      + LINK_ICON + ' View on TurboSquid</a></div>';
    grid.appendChild(card);
  }
  if (btn) btn.remove();
}

window.loadMore = loadMore;

})();
