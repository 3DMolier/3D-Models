(function(){
'use strict';

// g - номер категории модели, CATS - список слагов категорий из fc-index.json.
// Категория едет вместе с чанком, отдельного запроса не появляется. Осторожно:
// c - это cert, а не category; на этом легко решить, что категория уже есть.
var FC={i:[],n:[],p:[],s:[],c:[],g:[]}, IMGS={}, fcReady=false, CATS=[];
var searchQ='', selPrice=null, selCat=null, sortMode='sales';
var filtered=[], page=0, PAGE_SIZE=60, DEFAULT_LIMIT=100, noLimit=false;
var IDLE_PRELOAD_LIMIT=2, idlePreloaded=0;
var loadedImgChunkSet={};

var qEl=document.getElementById('q');
var sortSel=document.getElementById('sort-select');
var clearAll=document.getElementById('clear-all');
var lmBtn=document.getElementById('lm-btn');
var grid=document.getElementById('model-grid');
var statusText=document.getElementById('status-text');
var statusMsg=document.getElementById('status-msg');
var resultCount=document.getElementById('results-count');
var emptyEl=document.getElementById('empty');
var filterBar=document.getElementById('filter-bar');

var totalChunks=0, loadedChunks=0, imgChunks=0, totalImgChunks=0;
// Всего моделей в каталоге - из fc-index.json. Подпись в поле поиска должна
// называть весь каталог, а не первый загруженный кусок: он равен 10 000, и
// в поле висело «Search 10000 models…» при 59 637 в каталоге.
// Язык у toLocaleString указан явно: без него берётся язык браузера, и у
// русского посетителя выходило «59 637», у немецкого вышло бы «59.637»,
// тогда как весь остальной сайт пишет числа через запятую.
var totalModels=0;

function mergeChunk(chunk) {
  var keys=['i','n','p','s','c','g'];
  for(var k=0;k<keys.length;k++){
    var key=keys[k];
    FC[key]=FC[key].concat(chunk[key]||[]);
  }
}

function onFirstChunk() {
  fcReady=true;
  var loadingEl=document.getElementById('fc-loading');
  if(loadingEl)loadingEl.style.display='none';
  var spinner=statusMsg?statusMsg.querySelector('.bar-spinner'):null;
  if(spinner)spinner.style.display='none';
  if(statusText)statusText.textContent='';
  if(sortSel)sortSel.disabled=false;
  // Подсказку в поле НЕ переписываем числом: 54 077 и без того стоит в
  // заголовке и в счётчике выдачи, третий раз - перебор.
  if(qEl)qEl.disabled=false;
  if(filterBar)filterBar.classList.add('visible');
  applyFilters();
  var urlQ=new URLSearchParams(location.search).get('q');
  // Запрос из адреса приходит с чипа ключевого слова на карточке. Искать
  // надо по всему каталогу, а не по первому загруженному куску: иначе
  // «tesla model 3» находит десяток моделей вместо всех.
  if(urlQ&&qEl){qEl.value=urlQ;searchQ=urlQ.toLowerCase();applyFilters();ensureRemainingChunks();ensureRemainingImgChunks();}
  if('IntersectionObserver' in window) setupInfiniteScroll();
  // Если пришли сразу с фильтром категории, счёт должен быть верным с первого
  // экрана: /catalog/?cat=aircraft показывал «706 of 54077», пока догружались
  // чанки, хотя самолётов 1 495. Вызов именно здесь - на момент разбора
  // скрипта число чанков ещё неизвестно и догружать было бы нечего.
  if(selCat)ensureRemainingChunks();
  scheduleIdlePreload();
}

function scheduleIdlePreload(){
  if(idlePreloaded>=IDLE_PRELOAD_LIMIT||loadedChunks>=totalChunks)return;
  function run(){
    if(idlePreloaded>=IDLE_PRELOAD_LIMIT||loadedChunks>=totalChunks)return;
    loadChunk(loadedChunks);
    idlePreloaded++;
  }
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:2000});
  else setTimeout(run,1200);
}

// Догружаем ВСЕ оставшиеся чанки, а не один: раньше вызов подтягивал только
// следующий, и фильтр считал по загруженной части каталога. В строке состояния
// это выглядело как «706 of 19999» при 1 495 самолётах и 54 077 моделях, а
// число менялось по мере догрузки - отсюда и разные счётчики у Aircraft.
// Все шесть чанков весят 2,9 МБ и грузятся в простое, так что это дёшево.
function ensureRemainingChunks(){
  for(var i=loadedChunks;i<totalChunks;i++)loadChunk(i);
}

// Один чанк запрашивается один раз. Без этого фоновая подгрузка и догрузка по
// фильтру могли запросить один и тот же файл дважды, и модели из него легли бы
// в списки по второму разу - каталог показал бы дубликаты и завышенный счёт.
var requestedChunks={};
function loadChunk(i) {
  if(requestedChunks[i])return Promise.resolve();
  requestedChunks[i]=true;
  return fetch('/data/fc-chunk-'+i+'.json')
    .then(function(r){return r.json();})
    .then(function(chunk){
      mergeChunk(chunk);
      loadedChunks++;
      if(loadedChunks===1) onFirstChunk();
      else if(fcReady) applyFilters();
      // scheduleIdlePreload handles further auto-loading; no serial chain here
    })
    .catch(function(err){
      console.error('Chunk '+i+' failed:',err);
      delete requestedChunks[i];
      if(loadedChunks===0){
        var loadingEl=document.getElementById('fc-loading');
        if(loadingEl)loadingEl.innerHTML='Failed to load. <a href="javascript:location.reload()">Retry</a>';
      }
    });
}

function loadImgChunk(i) {
  if(i>=totalImgChunks||loadedImgChunkSet[i])return Promise.resolve();
  loadedImgChunkSet[i]=true;
  return fetch('/data/fc-img-chunk-'+i+'.json')
    .then(function(r){return r.json();})
    .then(function(chunk){
      Object.assign(IMGS, chunk);
      imgChunks++;
      injectLoadedImages();
    })
    .catch(function(){delete loadedImgChunkSet[i];});
}

function injectLoadedImages(){
  document.querySelectorAll('[data-img-pid]').forEach(function(el){
    var pid=el.dataset.imgPid;
    if(IMGS[pid]){
      var img=document.createElement('img');
      img.src=IMGS[pid];
      img.loading='lazy';
      img.setAttribute('width','800');
      img.setAttribute('height','450');
      img.decoding='async';
      el.parentNode.replaceChild(img,el);
    }
  });
}

function ensureRemainingImgChunks(){
  for(var i=0;i<totalImgChunks;i++){if(!loadedImgChunkSet[i])loadImgChunk(i);}
}

// Остальные чанки картинок откладываем. Раньше сразу после первого шёл
// ensureRemainingImgChunks, и страница тянула ВСЕ 18 файлов fc-img-chunk —
// 6.2 МБ JSON на первой загрузке (замер показал вес страницы 7.8 МБ).
// Первый чанк покрывает видимые карточки; остальные нужны при листании и поиске,
// поэтому запускаем их по первому действию пользователя либо в простое.
function scheduleRemainingImgChunks(){
  var started=false;
  function go(){ if(started)return; started=true; ensureRemainingImgChunks(); }
  ['scroll','keydown','pointerdown'].forEach(function(ev){
    window.addEventListener(ev, go, {once:true, passive:true});
  });
  if(window.requestIdleCallback) requestIdleCallback(go,{timeout:15000});
  else setTimeout(go,15000);
}

function startLoading(fcIdx, imgIdx) {
  CATS = fcIdx.cats || [];
  totalChunks = fcIdx.chunks;
  totalModels = fcIdx.total || 0;
  totalImgChunks = imgIdx.chunks;
  loadChunk(0);
  loadImgChunk(0).then(scheduleRemainingImgChunks);
}

Promise.all([
  fetch('/data/fc-index.json').then(function(r){return r.json();}),
  fetch('/data/fc-img-index.json').then(function(r){return r.json();})
]).then(function(res){ startLoading(res[0], res[1]); })
  .catch(function(){
    if(statusText)statusText.textContent='Failed to load catalog. Please refresh.';
  });

function applyFilters(){
  if(!fcReady)return;
  // Номер выбранной категории считаем один раз, а не для каждой из 54 тысяч
  // строк: indexOf внутри цикла превратил бы фильтр в квадрат.
  var catIdx = selCat===null ? -1 : CATS.indexOf(selCat);
  filtered=[];
  for(var i=0;i<FC.n.length;i++){
    if(searchQ&&FC.n[i].toLowerCase().indexOf(searchQ)===-1)continue;
    if(catIdx>=0&&FC.g[i]!==catIdx)continue;
    if(selPrice){
      var pr=FC.p[i];
      if(selPrice==='u5'&&pr>=5)continue;
      else if(selPrice==='u15'&&(pr<5||pr>=15))continue;
      else if(selPrice==='u30'&&(pr<15||pr>=30))continue;
      else if(selPrice==='u60'&&(pr<30||pr>=60))continue;
      else if(selPrice==='u120'&&(pr<60||pr>=120))continue;
      else if(selPrice==='u999'&&pr<120)continue;
    }
    filtered.push(i);
  }
  filtered.sort(function(a,b){
    if(sortMode==='sales')return(FC.s[b]||0)-(FC.s[a]||0);
    if(sortMode==='price_asc')return FC.p[a]-FC.p[b];
    if(sortMode==='price_desc')return FC.p[b]-FC.p[a];
    if(sortMode==='name')return FC.n[a]<FC.n[b]?-1:FC.n[a]>FC.n[b]?1:0;
    return 0;
  });
  /*
   * Первая выдача - сотня лидеров продаж, а не весь каталог. Без фильтров в
   * строке стояло «19 999 of 54 077»: столько никто не листает, а браузер
   * держал в памяти всю сетку. Как только человек что-то ищет или выбирает
   * категорию - ограничение снимается, там оно мешало бы.
   */
  noLimit = !!searchQ || selCat !== null || selPrice !== null;
  if (!noLimit && filtered.length > DEFAULT_LIMIT) filtered = filtered.slice(0, DEFAULT_LIMIT);
  page=0;
  // updateProgress() здесь больше не зовём: он внутри renderGrid. Снаружи он
  // отменял скрытие строки при нулевой выдаче - «Showing 0 of 0 models»
  // возвращалось прямо над надписью «No models found».
  renderGrid();
  updateStatus();
}

function renderGrid(){
  if(!grid||!fcReady)return;
  var toShow=filtered.slice(0,(page+1)*PAGE_SIZE);
  if(filtered.length===0){
    grid.innerHTML='';
    // Блок «нет результатов» показываем ТОЛЬКО когда человек действительно
    // что-то искал или фильтровал. Раньше он всегда лежал в разметке и лишь
    // прятался стилем: робот и читающая программа видели «No models found» и
    // «Showing 0 of 0» сразу под списком из 48 найденных моделей. Атрибут
    // hidden, а не display: скрытое стилем всё равно попадает в дерево
    // доступности, а у заголовка внутри стоит role="status" - его объявляют
    // вслух при появлении.
    var searched=!!searchQ||selPrice!==null||selCat!==null;
    if(emptyEl){ if(searched)emptyEl.removeAttribute('hidden'); else emptyEl.setAttribute('hidden',''); }
    if(lmBtn)lmBtn.style.display='none';
    // При нуле результатов строка «Showing X of Y» врала бы прошлыми
    // числами прямо над надписью «No models found». Прячем её.
    var pg=document.getElementById('fc-progress');
    if(pg)pg.setAttribute('hidden','');
    return;
  }
  if(emptyEl)emptyEl.setAttribute('hidden','');
  var html='';
  for(var i=0;i<toShow.length;i++)html+=modelCard(toShow[i]);
  grid.innerHTML=html;
  if(lmBtn){
    if(toShow.length<filtered.length){
      lmBtn.style.display='block';
      lmBtn.textContent='Load more ('+(filtered.length-toShow.length)+' remaining)';
    }else{lmBtn.style.display='none';}
  }
  // Строку «Showing X of Y» обновляем здесь, а не у каждого, кто зовёт
  // renderGrid. Раньше её обновляли снаружи, и обработчик кнопки «Load more»
  // это делать забывал: после прокрутки поиска по слову helicopter на экране
  // лежали все 262 карточки, а строка упрямо повторяла «Showing 60 of 262».
  updateProgress();
}

function makeSlug(name,id){
  var s=name.toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'');
  return s+'-'+id;
}

function modelCard(idx){
  var id=FC.i[idx],name=FC.n[idx],price=FC.p[idx],cert=FC.c[idx],sales=FC.s[idx];
  var slug=makeSlug(name,id);
  var imgHtml=IMGS[id]
    ?'<img src="'+IMGS[id]+'" alt="'+name.replace(/"/g,'&quot;')+'" loading="lazy" width="800" height="450" decoding="async">'
    :'<div class="mc-ph" data-img-pid="'+id+'">&#128246;</div>';
  var certBadge=cert===2?'<span class="mc-cert cert-cm">CheckMate</span>'
    :cert===1?'<span class="mc-cert cert-sc">StemCell</span>':'';
  var salesHtml=sales?'<span class="mc-sold">'+sales+' sold</span>':'';
  return '<a href="/models/'+slug+'/" class="mc" role="listitem">'
    +'<div class="mc-img">'+imgHtml+'<div class="mc-ov"></div>'+certBadge+'<div class="mc-qv">View Model</div></div>'
    +'<div class="mc-body"><div class="mc-name">'+name+'</div>'
    +'<div class="mc-foot"><span class="mc-price">$'+price+'</span>'+salesHtml+'</div>'
    +'</div></a>';
}

function updateStatus(){
  // FC.n.length - это сколько моделей УЖЕ загружено, а не сколько их в
  // каталоге. Пока догружались чанки, в строке стояло «706 of 19999», хотя
  // моделей 54 077, а самолётов 1 495. Отсюда и бралось третье число для
  // Aircraft - рядом с плиткой главной и счётчиком категории.
  var total=totalModels||FC.n.length;
  if(resultCount)resultCount.innerHTML='<strong>'+filtered.length+'</strong> of '+total+' models';
  if(statusText)statusText.textContent='';
}

if(qEl){
  var debT=null;
  qEl.addEventListener('input',function(){
    clearTimeout(debT);var val=this.value.trim();
    debT=setTimeout(function(){
      searchQ=val.toLowerCase();
      applyFilters();
      if(val.length>1){ensureRemainingChunks();ensureRemainingImgChunks();}
    },220);
  });
}
if(sortSel)sortSel.addEventListener('change',function(){sortMode=this.value;ensureRemainingChunks();ensureRemainingImgChunks();applyFilters();});
if(clearAll)clearAll.addEventListener('click',function(){
  searchQ='';selPrice=null;selCat=null;
  if(qEl)qEl.value='';
  document.querySelectorAll('.ftag').forEach(function(b){b.classList.remove('active');});
  clearAll.classList.remove('show');
  applyFilters();
});
if(lmBtn)lmBtn.addEventListener('click',function(){ensureRemainingImgChunks();page++;renderGrid();});

document.querySelectorAll('.ftag[data-price]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var pr=this.dataset.price;
    if(selPrice===pr){selPrice=null;this.classList.remove('active');}
    else{document.querySelectorAll('.ftag[data-price]').forEach(function(b){b.classList.remove('active');});selPrice=pr;this.classList.add('active');}
    if(clearAll)clearAll.classList.toggle('show',selPrice!==null||selCat!==null||!!searchQ);
    if(typeof gtag==='function')gtag('event','filter_price',{price_band:selPrice||'none',page_type:'catalog'});
    ensureRemainingChunks();ensureRemainingImgChunks();applyFilters();
  });
});
// Фильтр по категориям. Кнопки лежат в разметке статически, слаг в data-cat -
// так их видит и робот, и человек с выключенным JS.
document.querySelectorAll('.ftag[data-cat]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var cat=this.dataset.cat;
    if(selCat===cat){selCat=null;this.classList.remove('active');}
    else{document.querySelectorAll('.ftag[data-cat]').forEach(function(b){b.classList.remove('active');});selCat=cat;this.classList.add('active');}
    if(clearAll)clearAll.classList.toggle('show',selPrice!==null||selCat!==null||!!searchQ);
    if(typeof gtag==='function')gtag('event','filter_category',{category:selCat||'none',page_type:'catalog'});
    ensureRemainingChunks();ensureRemainingImgChunks();applyFilters();
  });
});

// На каталог можно прийти с уже выбранной категорией: /catalog/?cat=aircraft.
// Сами при щелчке адрес не меняем - иначе у страницы появятся десятки адресов
// с одним и тем же содержимым, и Google начнёт считать их разными страницами.
(function(){
  var m=/[?&]cat=([a-z0-9-]+)/.exec(location.search);
  if(!m)return;
  var btn=document.querySelector('.ftag[data-cat="'+m[1]+'"]');
  if(!btn)return;
  selCat=m[1];
  btn.classList.add('active');
  if(clearAll)clearAll.classList.add('show');
})();

document.querySelectorAll('.ps-tag').forEach(function(btn){
  btn.addEventListener('click',function(){
    var q=this.dataset.q;
    if(qEl)qEl.value=q;
    searchQ=q.toLowerCase();
    applyFilters();
  });
});


function setupInfiniteScroll() {
  var sentinel = document.getElementById('fc-sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'fc-sentinel';
    sentinel.style.height = '1px';
    var gridWrap = grid && grid.parentNode;
    if (gridWrap) gridWrap.insertBefore(sentinel, grid.nextSibling);
  }
  var io = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting && fcReady) {
      var shown = (page + 1) * PAGE_SIZE;
      if (shown < filtered.length) { ensureRemainingImgChunks(); page++; renderGrid(); updateProgress(); }
    }
  }, { rootMargin: '400px' });
  io.observe(sentinel);
}

function updateProgress() {
  // Строка лежит в разметке скрытой и показывается, только когда числа
  // настоящие. Иначе робот читал «Showing 0 of 0 models» сразу под списком
  // из полусотни найденных моделей.
  var prog = document.getElementById('fc-progress');
  if (prog) prog.removeAttribute('hidden');
  var shown = Math.min((page + 1) * PAGE_SIZE, filtered.length);
  var shownEl = document.getElementById('fc-shown');
  var totalEl = document.getElementById('fc-total');
  // Язык обязателен - см. комментарий у totalModels выше. Без него у русского
  // посетителя выходит «54 079» с неразрывными пробелами вместо запятых.
  if (shownEl) shownEl.textContent = shown.toLocaleString('en-US');
  if (totalEl) totalEl.textContent = filtered.length.toLocaleString('en-US');
}

// Recently Viewed display
(function(){
  try{
    var rv=JSON.parse(localStorage.getItem('rv')||'[]');
    if(rv.length===0)return;
    var hero=document.querySelector('.hero');
    if(!hero)return;
    var html='<div class="rv-section"><div class="rv-label">Recently Viewed</div><div class="rv-list">';
    rv.slice(0,8).forEach(function(item){
      html+='<a href="'+item.url+'" class="rv-card">'
        +(item.img?('<img src="'+item.img+'" loading="lazy">'):'')
        +'<span>'+item.name.substring(0,24)+(item.name.length>24?'…':'')+'</span></a>';
    });
    html+='</div></div>';
    hero.insertAdjacentHTML('beforeend',html);
  }catch(e){}
})();

/*
 * «View all» раскрывает остальные восемнадцать категорий. Без неё в строке
 * фильтров стояли все двадцать шесть подряд, и глаз в них тонул.
 */
(function () {
  var btn = document.getElementById('cat-more');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.ftag--rest').forEach(function (b) {
      if (open) b.setAttribute('hidden', ''); else b.removeAttribute('hidden');
    });
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    btn.innerHTML = open ? 'View all 26 &#8595;' : 'Show fewer &#8593;';
  });
})();

})();
