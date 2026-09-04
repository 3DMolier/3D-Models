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

// Поиск с главной ведёт прямо в каталог. Раньше он вёл на /search/, а тот
// страницей-указателем перебрасывал на /catalog/ - лишний шаг для человека и
// разрыв цепочки для поисковика. Каталог сам читает ?q= из адреса.
var heroSearch=d.querySelector('.hero-search-wrap .search-input');
var heroBtn=d.querySelector('.hero-search-wrap .search-btn');
if(heroSearch&&heroBtn){
  function doHeroSearch(){var q=heroSearch.value.trim();if(q)window.location.href='/catalog/?q='+encodeURIComponent(q);}
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
// Что это за страница - нужно почти каждому событию.
function pageType(){
  var p=location.pathname;
  if(p.indexOf('/models/')===0)return 'model';
  if(/^\/categories\/[^/]+\/[^/]+\//.test(p)&&p.indexOf('/page/')<0)return 'subcategory';
  if(p.indexOf('/categories/')===0)return 'category';
  if(p.indexOf('/collections/')===0)return 'collection';
  if(p.indexOf('/industries/')===0)return 'industry';
  if(p.indexOf('/catalog/')===0)return 'catalog';
  if(p.indexOf('/search/')===0)return 'search';
  if(p==='/')return 'home';
  return 'other';
}
window.mpPageType=pageType;

// Сведения о модели берём из разметки товара: она есть на каждой карточке,
// и это надёжнее, чем вылавливать цену из вёрстки.
var PRODUCT=(function(){
  var out={};
  var blocks=document.querySelectorAll('script[type="application/ld+json"]');
  for(var i=0;i<blocks.length;i++){
    try{
      var o=JSON.parse(blocks[i].textContent);
      if(o&&o['@type']==='Product'){
        out.model_name=o.name||'';
        out.model_id=o.sku||o.productID||'';
        if(o.offers&&o.offers.price!==undefined)out.price=o.offers.price;
        if(o.category)out.category=o.category;
        break;
      }
    }catch(err){/* разметка не разобралась - обойдёмся без неё */}
  }
  if(!out.category){
    var bc=document.querySelector('.mp-bc-inner a[href^="/categories/"]');
    if(bc)out.category=bc.textContent.trim();
  }
  return out;
})();

// Просмотр карточки. page_view такого не покажет: он не знает ни цены, ни
// категории, а вопрос у нас ровно про них.
if(pageType()==='model'&&PRODUCT.model_name){
  gaEvent('view_model',{model_id:PRODUCT.model_id,model_name:PRODUCT.model_name,
    category:PRODUCT.category||'',price:PRODUCT.price||0,page_type:'model'});
}
if(pageType()==='collection'){
  var _ch1=document.querySelector('h1');
  gaEvent('view_collection',{collection:location.pathname,name:_ch1?_ch1.textContent.trim():''});
}

// Порядковый номер карточки в списке: без него не ответить, работает ли
// первый экран или люди листают до конца.
function cardPosition(el){
  var card=el.closest&&el.closest('.model-card, .tile, .s-mc, .mp-rc-link');
  if(!card||!card.parentNode)return 0;
  var sibs=card.parentNode.children,n=0;
  for(var i=0;i<sibs.length;i++){ if(sibs[i]===card)return n+1; if(sibs[i].nodeType===1)n++; }
  return 0;
}

document.addEventListener('click',function(e){
  var t=e.target;
  if(!t||!t.closest)return;
  // Переход на TurboSquid - ключевая микроконверсия, поэтому со всеми полями.
  var tsLink=t.closest('a[href*="turbosquid.com"]');
  if(tsLink){
    var slug=location.pathname.replace(/^\/models\//,'').replace(/\/$/,'');
    var idFromHref=(tsLink.getAttribute('href')||'').match(/[-\/](\d{5,})(\?|$)/);
    gaEvent('click_turbosquid',{
      model_id:PRODUCT.model_id||(idFromHref?idFromHref[1]:''),
      model_name:PRODUCT.model_name||tsLink.textContent.trim().slice(0,80),
      category:PRODUCT.category||'',
      price:PRODUCT.price||0,
      page_type:pageType(),
      card_position:cardPosition(tsLink),
      model_slug:slug
    });
  }
  if(t.closest('a[href*="custom-order"]'))gaEvent('custom_order_click',{page:location.pathname,page_type:pageType()});
  // Обращение по лицензированию данных - вторая по важности конверсия.
  var dl=t.closest('a[href^="mailto:"]');
  if(dl&&location.pathname.indexOf('/data-licensing/')===0)
    gaEvent('data_license_lead',{page:location.pathname,target:(dl.getAttribute('href')||'').slice(0,60)});
  if(t.closest('#lm-btn'))gaEvent('load_more_click',{page:location.pathname,page_type:pageType()});
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

// Галерея объединённой карточки: клик по миниатюре меняет крупное изображение.
// Разметка статическая — без скрипта видны все снимки, просто не переключаются.
(function(){
  var gal = document.querySelector('[data-gallery]');
  if(!gal) return;
  var hero = document.querySelector('.mp-hero-img');
  if(!hero) return;
  gal.addEventListener('click', function(e){
    var btn = e.target.closest ? e.target.closest('.mp-gal-thumb') : null;
    if(!btn) return;
    var full = btn.getAttribute('data-full');
    if(!full) return;
    hero.src = full;
    hero.setAttribute('data-fallback', full);
    // Подпись под крупным снимком должна меняться вместе с ним, иначе на карточке
    // серии непонятно, какой именно выпуск сейчас открыт.
    var cap = gal.querySelector('[data-gal-cap]');
    var capText = btn.getAttribute('data-cap');
    if(cap && capText) cap.textContent = capText;
    var on = gal.querySelector('.mp-gal-thumb.is-on');
    if(on) on.classList.remove('is-on');
    btn.classList.add('is-on');
  });
})();

// ── Просмотр снимка во весь экран ────────────────────────────────────────────
//
// Исходники превью - 1920x1080, а в карточке они показываются в рамке около
// 530 пикселей. Деталей втрое больше, чем видит посетитель, и для 3D-модели это
// как раз то, ради чего её и разглядывают.
//
// Разметку страниц не трогаем: полный адрес уже стоит в src героя и в data-full
// у миниатюр. Слой создаётся скриптом при первом открытии.
//
// По клику на сам снимок - приближение один к одному, а не закрытие: закрывать
// кликом по картинке неудобно, в неё как раз тычут, чтобы рассмотреть. Закрытие -
// по фону, по крестику и по Esc.
(function(){
  var hero = document.querySelector('.mp-hero-img');
  if(!hero) return;
  var gal = document.querySelector('[data-gallery]');

  var box, img, cap, counter, prevBtn, nextBtn, lastFocus, zoom = false;

  function shots(){
    if(!gal) return [{ src: hero.getAttribute('src'), cap: '' }];
    var list = [];
    gal.querySelectorAll('.mp-gal-thumb').forEach(function(b){
      var f = b.getAttribute('data-full');
      if(f) list.push({ src: f, cap: b.getAttribute('data-cap') || '' });
    });
    return list.length ? list : [{ src: hero.getAttribute('src'), cap: '' }];
  }
  var items = [], idx = 0;

  function build(){
    box = document.createElement('div');
    box.className = 'mp-lb';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Full size preview');
    box.innerHTML =
      '<button type="button" class="mp-lb-close" aria-label="Close">&#10005;</button>' +
      '<button type="button" class="mp-lb-nav mp-lb-prev" aria-label="Previous image">&#8249;</button>' +
      '<button type="button" class="mp-lb-nav mp-lb-next" aria-label="Next image">&#8250;</button>' +
      '<div class="mp-lb-stage"><img class="mp-lb-img" alt=""></div>' +
      '<div class="mp-lb-bar"><span class="mp-lb-cap"></span><span class="mp-lb-count"></span></div>';
    document.body.appendChild(box);
    img = box.querySelector('.mp-lb-img');
    cap = box.querySelector('.mp-lb-cap');
    counter = box.querySelector('.mp-lb-count');
    prevBtn = box.querySelector('.mp-lb-prev');
    nextBtn = box.querySelector('.mp-lb-next');

    box.addEventListener('click', function(e){
      if(e.target === box || e.target.classList.contains('mp-lb-stage')) close();
    });
    box.querySelector('.mp-lb-close').addEventListener('click', close);
    prevBtn.addEventListener('click', function(e){ e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', function(e){ e.stopPropagation(); step(1); });
    img.addEventListener('click', function(e){ e.stopPropagation(); toggleZoom(); });

    // Свайп на телефоне.
    var x0 = null;
    box.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function(e){
      if(x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if(Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  function show(){
    var it = items[idx] || items[0];
    if(!it) return;
    img.src = it.src;
    img.alt = it.cap || (document.querySelector('.mp-h1') || {}).textContent || '';
    cap.textContent = it.cap || '';
    counter.textContent = items.length > 1 ? (idx + 1) + ' / ' + items.length : '';
    var many = items.length > 1;
    prevBtn.hidden = !many; nextBtn.hidden = !many;
    if(zoom) toggleZoom();
  }
  function step(d){
    if(items.length < 2) return;
    idx = (idx + d + items.length) % items.length;
    show();
  }
  function toggleZoom(){
    zoom = !zoom;
    box.classList.toggle('is-zoom', zoom);
    img.style.cursor = zoom ? 'zoom-out' : 'zoom-in';
  }
  function onKey(e){
    if(e.key === 'Escape') close();
    else if(e.key === 'ArrowLeft') step(-1);
    else if(e.key === 'ArrowRight') step(1);
  }
  function open(startSrc){
    if(!box) build();
    items = shots();
    idx = Math.max(0, items.findIndex(function(x){ return x.src === startSrc; }));
    lastFocus = document.activeElement;
    show();
    box.classList.add('is-open');
    document.documentElement.classList.add('mp-lb-lock');
    document.addEventListener('keydown', onKey);
    box.querySelector('.mp-lb-close').focus();
  }
  function close(){
    if(!box) return;
    box.classList.remove('is-open', 'is-zoom');
    zoom = false;
    document.documentElement.classList.remove('mp-lb-lock');
    document.removeEventListener('keydown', onKey);
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  hero.style.cursor = 'zoom-in';
  hero.addEventListener('click', function(){ open(hero.getAttribute('src')); });

  // С клавиатуры герой тоже должен открываться.
  var frame = hero.closest ? hero.closest('.mp-hero-frame') : null;
  if(frame){
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('role', 'button');
    frame.setAttribute('aria-label', 'Open full size preview');
    frame.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(hero.getAttribute('src')); }
    });
  }
})();
