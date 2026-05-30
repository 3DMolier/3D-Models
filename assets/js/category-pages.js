(function(){
'use strict';
// Read config from body data attributes (preferred) or legacy global vars
var EXTRA_MODELS_URL = document.body.dataset.extraModelsUrl
  || (typeof window.EXTRA_MODELS_URL !== 'undefined' ? window.EXTRA_MODELS_URL : '');
var COLOR = document.body.dataset.color
  || (typeof window.COLOR !== 'undefined' ? window.COLOR : '#4F9EFF');

function proxyImg(url){if(!url)return'';if(url.indexOf('p.turbosquid.com')!==-1)return url;var c=String(url).replace(/^https?:\/\//,'');return'https://images.weserv.nl/?url=ssl:'+encodeURIComponent(c)+'&w=600&q=85&output=webp';}
function originalImg(url){return url||'/3D-Models/assets/og/3d-molier-og.jpg';}

var loaded = false;

function renderExtraModels(grid, btn, models) {
  var color = COLOR;
  var LINK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    var certHtml = m.cert === 'CM'
      ? '<span class="cert-badge">&#10003; CM</span>'
      : m.cert === 'SC'
        ? '<span class="cert-badge" style="background:rgba(124,58,237,0.1);border-color:rgba(124,58,237,0.25);color:#7C3AED;">SC</span>'
        : '';
    var imgHtml = m.img
      ? '<img src="' + proxyImg(m.img) + '" data-fallback="' + originalImg(m.img) + '" data-placeholder="/3D-Models/assets/og/3d-molier-og.jpg" alt="' + m.title.replace(/"/g,'&quot;') + '" loading="lazy" width="800" height="450" decoding="async" onerror="handleImageError(this)"><div class="img-placeholder" style="color:' + color + ';display:none;"><span style="font-size:28px;opacity:0.5;">&#128247;</span><span style="color:' + color + ';">' + m.cat + '</span></div>'
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

function loadMore() {
  if (loaded) return;
  loaded = true;
  var grid = document.getElementById('model-grid');
  var btn = document.getElementById('load-more-wrap');
  if (!grid) return;

  // New approach: fetch external JSON (from data-extra-models-url or global)
  if (EXTRA_MODELS_URL) {
    var btnEl = btn ? btn.querySelector('button') : null;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Loading…'; }
    fetch(EXTRA_MODELS_URL)
      .then(function(r) { return r.json(); })
      .then(function(models) { renderExtraModels(grid, btn, models); })
      .catch(function() { if (btn) btn.remove(); });
    return;
  }

  // Legacy fallback: inline EXTRA_MODELS array
  if (typeof EXTRA_MODELS === 'undefined') return;
  renderExtraModels(grid, btn, EXTRA_MODELS);
}

window.loadMore = loadMore;

function initFilterChips() {
  document.querySelectorAll('.cat-chip, .filter-chip').forEach(function(chip) {
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', function() {
      var isActive = chip.classList.contains('active');
      document.querySelectorAll('.cat-chip, .filter-chip').forEach(function(c) {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      if (!isActive) {
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initFilterChips);

document.addEventListener('error', function(e) {
  if (e.target && e.target.tagName === 'IMG' && typeof imgErr === 'function') {
    imgErr(e.target);
  }
}, true);

})();
