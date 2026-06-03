function handleImageError(img) {
  if (!img) return;
  var fallback = img.getAttribute('data-fallback');
  var placeholder = img.getAttribute('data-placeholder') || '/assets/og/3d-molier-og.jpg';
  if (!img.dataset.triedFallback && fallback && img.src !== fallback) {
    img.dataset.triedFallback = '1';
    img.src = fallback;
    return;
  }
  if (!img.dataset.triedPlaceholder && placeholder && img.src !== placeholder) {
    img.dataset.triedPlaceholder = '1';
    img.src = placeholder;
    return;
  }
  img.classList.add('img-error');
  var sib = img.nextElementSibling;
  if (sib && sib.classList.contains('img-placeholder')) {
    img.style.display = 'none';
    sib.style.display = 'flex';
  }
}
window.handleImageError = handleImageError;

function imgErr(img) {
  var direct = img.getAttribute('data-fallback') || img.getAttribute('data-src');
  if (direct && img.src !== direct) {
    img.src = direct;
    return;
  }
  img.style.display = 'none';
  var sib = img.nextElementSibling;
  if (sib) sib.style.display = 'flex';
}

(function(){
var p=location.pathname,d=document;
// Redirect old /3dmolier-models/ → /
if(p.indexOf('/3dmolier-models/')===0)location.replace('/'+p.slice('/3dmolier-models/'.length)+location.search+location.hash);
// Legacy URL redirects (for old industry slugs without hyphens)
var _r={'/industries/softwaredevelopment/':'/industries/software-development/','/industries/eventmanagement/':'/industries/event-management/','/industries/3dprinting/':'/industries/3d-printing/'};
if(_r[p])location.replace(_r[p]);
d.querySelectorAll('.nav-link,.nav-dropdown a,.nav-mobile a,.nav-mobile-sub a').forEach(function(el){
  var h=el.getAttribute('href');if(!h||h.indexOf('turbosquid')>-1)return;
  if(h===p||(h.length>14&&p.startsWith(h))){el.classList.add('active');el.setAttribute('aria-current','page');}
});
var burger=d.getElementById('nav-burger'),mob=d.getElementById('nav-mobile');
if(burger&&mob){burger.addEventListener('click',function(){var o=mob.classList.toggle('open');burger.classList.toggle('open',o);burger.setAttribute('aria-expanded',''+o);mob.setAttribute('aria-hidden',String(!o));if(o){var f=mob.querySelector('a,button');if(f)f.focus();}});}
function setupDropdown(btnId,wrapId){var btn=d.getElementById(btnId),wrap=d.getElementById(wrapId);if(!btn||!wrap)return;var t=null;function open(){clearTimeout(t);wrap.classList.add('open');btn.setAttribute('aria-expanded','true');}function close(){wrap.classList.remove('open');btn.setAttribute('aria-expanded','false');}function sc(){t=setTimeout(close,160);}wrap.addEventListener('mouseenter',open);wrap.addEventListener('mouseleave',sc);btn.addEventListener('click',function(e){e.stopPropagation();wrap.classList.contains('open')?close():open();});d.addEventListener('click',function(e){if(!wrap.contains(e.target))close();});d.addEventListener('keydown',function(e){if(e.key==='Escape'){close();btn.focus();}});}
setupDropdown('nav-cat-btn','nav-cat-wrap');
setupDropdown('nav-ind-btn','nav-ind-wrap');
function mobToggle(btnId,subId){var btn=d.getElementById(btnId),sub=d.getElementById(subId);if(btn&&sub){btn.addEventListener('click',function(){var o=sub.classList.toggle('open');btn.setAttribute('aria-expanded',''+o);var c=btn.querySelector('.nav-caret');if(c)c.style.transform=o?'rotate(180deg)':'';});}}
mobToggle('mob-cat-toggle','mob-cat-sub');
mobToggle('mob-ind-toggle','mob-ind-sub');

// Homepage hero search → /search/?q=...
var heroSearch=d.querySelector('.hero-search-wrap .search-input');
var heroBtn=d.querySelector('.hero-search-wrap .search-btn');
if(heroSearch&&heroBtn){
  function doHeroSearch(){var q=heroSearch.value.trim();if(q)window.location.href='/search/?q='+encodeURIComponent(q);}
  heroBtn.addEventListener('click',doHeroSearch);
  heroSearch.addEventListener('keydown',function(e){if(e.key==='Enter')doHeroSearch();});
}

// Make model-card image area clickable — opens TurboSquid link for that card
document.addEventListener('click',function(e){
  var imgWrap=e.target.closest&&e.target.closest('.model-card .img-wrap');
  if(!imgWrap)return;
  var card=imgWrap.closest('.model-card');
  if(!card)return;
  var link=card.querySelector('.btn-ts, a[href*="turbosquid.com"]');
  if(link){e.preventDefault();window.open(link.href,'_blank','noopener');}
});

// GA4 event tracking
function gaEvent(name,params){if(typeof gtag==='function')gtag('event',name,params||{});}
document.addEventListener('click',function(e){
  // TurboSquid click
  var tsLink=e.target.closest&&e.target.closest('a[href*="turbosquid.com"]');
  if(tsLink){
    var slug=location.pathname.replace(/^\/models\//,'').replace(/\/$/,'');
    gaEvent('turbosquid_click',{model_slug:slug,page:location.pathname});
  }
  // Custom order click
  if(e.target.closest&&e.target.closest('a[href*="custom-order"]'))gaEvent('custom_order_click',{page:location.pathname});
  // Load more click
  if(e.target.closest&&e.target.closest('#lm-btn'))gaEvent('load_more_click',{page:location.pathname});
});
// Image fallback tracking
var _origImgErr=window.imgErr;
window.imgErr=function(img){gaEvent('image_fallback_triggered',{src:img&&img.src?img.src.substring(0,80):''});if(_origImgErr)_origImgErr(img);};
// Search query tracking
(function(){
  var sq=new URLSearchParams(location.search).get('q');
  if(sq&&location.pathname.indexOf('/search/')>-1)gaEvent('search_query',{query:sq});
})();
})();
