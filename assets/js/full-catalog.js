(function(){
'use strict';

// g - номер категории модели, CATS - список слагов категорий из fc-index.json.
// Категория едет вместе с чанком, отдельного запроса не появляется. Осторожно:
// c - это cert, а не category; на этом легко решить, что категория уже есть.
var FC={i:[],n:[],p:[],s:[],c:[],g:[],ic:[]}, IMGS={}, fcReady=false, CATS=[];
var searchQ='', selPrice=null, selCat=null, sortMode='sales', onlyRigged=false;
// Признак «с оснасткой» берём из названия модели: слово Rigged стоит в нём у
// 3 705 карточек, тогда как отдельное поле из выгрузки студии есть лишь у
// 2 154 и почти целиком входит в первое. Значит новых данных возить не нужно -
// имя и так едет вместе с каталогом.
var RIGGED=/\brigged\b/i;
/*
 * Каталог листается СТРАНИЦАМИ, как разделы категорий: та же навигация внизу,
 * те же сто карточек на странице, тот же вид кнопок.
 *
 * Что было. Выдача без фильтров резалась сотней насовсем, кнопки перехода не
 * было вовсе, и каталог из 54 527 моделей заканчивался на сотой карточке.
 * Потом на её месте появилась кнопка «Load more (54 427 remaining)» - она
 * висела слева под сеткой, ничего не сообщала о том, где ты находишься, и
 * прокручивала ленту без конца и без возможности вернуться.
 *
 * Страница едет в адресе (?page=N): ссылку можно отправить, кнопка «назад»
 * работает, и обходчик видит нумерацию, а не бесконечную ленту.
 */
/*
 * page - какую страницу РИСУЕМ, wantedPage - какую просили.
 *
 * Числа расходятся в двух случаях, и оба живые:
 *   • куски каталога ещё грузятся, и запрошенной страницы пока не существует;
 *   • в адресе номер больше, чем есть страниц (?page=900 при 546).
 * Без разделения выходила пустая сетка и строка «Showing 89,901-54,519 of
 * 54,519 models»: срез начинался за концом списка. Теперь рисуем ближайшую
 * существующую, а как только данные догрузятся - ту, что просили.
 */
var filtered=[], page=0, wantedPage=0, PAGE_SIZE=100;
var IDLE_PRELOAD_LIMIT=2, idlePreloaded=0;
var loadedImgChunkSet={};

var qEl=document.getElementById('q');
var sortSel=document.getElementById('sort-select');
var clearAll=document.getElementById('clear-all');
var grid=document.getElementById('model-grid');
var statusText=document.getElementById('status-text');
var statusMsg=document.getElementById('status-msg');
var resultCount=document.getElementById('results-count');
// Блока «нет результатов» в разметке больше нет - его создаёт emptyBlock().
var filterBar=document.getElementById('filter-bar');

var totalChunks=0, loadedChunks=0, imgChunks=0, totalImgChunks=0;
// Строк в одном куске. Узнаём из первого пришедшего, а не зашиваем числом:
// раскладка задаётся сборкой каталога и может измениться.
var CHUNK_ROWS=0;
// Всего моделей в каталоге - из fc-index.json. Подпись в поле поиска должна
// называть весь каталог, а не первый загруженный кусок: он равен 10 000, и
// в поле висело «Search 10000 models…» при 59 637 в каталоге.
// Язык у toLocaleString указан явно: без него берётся язык браузера, и у
// русского посетителя выходило «59 637», у немецкого вышло бы «59.637»,
// тогда как весь остальной сайт пишет числа через запятую.
var totalModels=0;

function mergeChunk(chunk) {
  // ic - номер файла, в котором лежит адрес картинки этой модели. Колонка уже
  // была в данных, но каталог её выбрасывал и потому не знал, какой из 18
  // файлов ему нужен: приходилось грузить все.
  var keys=['i','n','p','s','c','g','ic'];
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
  // Номер страницы из адреса - чтобы ссылка на /catalog/?page=7 открывала
  // седьмую сотню, а не первую.
  var urlPage=parseInt(new URLSearchParams(location.search).get('page')||'1',10);
  if(!isNaN(urlPage)&&urlPage>1)wantedPage=urlPage-1;
  applyFilters(wantedPage>0);
  var urlQ=new URLSearchParams(location.search).get('q');
  // Запрос из адреса приходит с чипа ключевого слова на карточке. Искать
  // надо по всему каталогу, а не по первому загруженному куску: иначе
  // «tesla model 3» находит десяток моделей вместо всех.
  if(urlQ&&qEl){qEl.value=urlQ;searchQ=urlQ.toLowerCase();applyFilters();ensureRemainingChunks();}
  // Если пришли сразу с фильтром категории, счёт должен быть верным с первого
  // экрана: /catalog/?cat=aircraft показывал «706 of 54077», пока догружались
  // чанки, хотя самолётов 1 495. Вызов именно здесь - на момент разбора
  // скрипта число чанков ещё неизвестно и догружать было бы нечего.
  if(selCat)ensureRemainingChunks();
  // Кусок под запрошенную страницу - остальные не трогаем, см. chunkForPage.
  ensureChunkForPage(wantedPage);
  scheduleIdlePreload();
}

/*
 * ЧИСЛО СТРАНИЦ И НУЖНЫЙ КУСОК - без загрузки всего каталога.
 *
 * Куски отсортированы по продажам сквозь весь каталог: в нулевом лежат первые
 * 10 000 по продажам, в первом - следующие 10 000, и так далее. Значит при
 * сортировке по умолчанию и без фильтров страница из ста карточек целиком
 * лежит в одном куске, и вычислить в каком - простое деление. Десять тысяч
 * делится на сотню без остатка, поэтому страница никогда не лежит на стыке.
 *
 * Отсюда две вещи. Число страниц берётся из fc-index.json (файл в 1 КБ), а не
 * из длины загруженной выдачи - навигация верна с первого кадра. И грузится
 * ровно один кусок вместо шести: 0,15 МБ вместо 0,9 МБ в сжатом виде.
 *
 * Как только человек ищет, фильтрует или меняет сортировку - порядок больше не
 * совпадает с раскладкой по кускам, и каталог подтягивается целиком. Это уже
 * делает ensureRemainingChunks в обработчиках фильтров.
 */
function plainOrder(){
  return !searchQ && selCat===null && selPrice===null && !onlyRigged && sortMode==='sales';
}
function totalPages(){
  var n = plainOrder() ? (totalModels || filtered.length) : filtered.length;
  return Math.max(1, Math.ceil(n / PAGE_SIZE));
}
function ensureChunkForPage(p){
  if(!plainOrder()){ ensureRemainingChunks(); return; }
  var rows = CHUNK_ROWS || 0;
  if(!rows){ ensureRemainingChunks(); return; }
  var need = Math.floor((p * PAGE_SIZE) / rows);
  for(var i=0;i<=need && i<totalChunks;i++) loadChunk(i);
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
      if(!CHUNK_ROWS&&i===0&&chunk.i)CHUNK_ROWS=chunk.i.length;
      mergeChunk(chunk);
      loadedChunks++;
      if(loadedChunks===1) onFirstChunk();
      // Пришедший кусок пересобирает выдачу, но НЕ отматывает её в начало.
      // Раньше applyFilters сбрасывал page в ноль, и после «Load more» сетка
      // прыгала обратно на первые 60 карточек всякий раз, когда догружался
      // очередной кусок: досмотреть каталог было нельзя.
      else if(fcReady) applyFilters(true);
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

// Адреса картинок разложены по 18 файлам общим весом 18 МБ. Раньше страница
// откладывала их до первой прокрутки, а потом тянула ВСЕ ВОСЕМНАДЦАТЬ - то
// есть 18 МБ разбора JSON ради шестидесяти видимых карточек.
//
// Грузим ровно те файлы, в которых лежат показанные сейчас модели. Номер файла
// известен из колонки ic, она едет вместе с данными каталога и лишнего запроса
// не создаёт. Замер по нашим данным: первой странице нужно 2 файла из 18, это
// 1,5 МБ вместо 18,1 МБ; поиску по слову helicopter - тоже 2. Дальше человек
// листает, и подгружается только то, что он действительно увидел.
//
// ic === -1 значит «картинки у модели нет»: на её месте останется рамка-заглушка,
// и запрашивать ради неё файл не нужно.
function ensureImgChunksFor(rows){
  var want={};
  for(var i=0;i<rows.length;i++){
    var k=FC.ic[rows[i]];
    if(typeof k==='number'&&k>=0&&!loadedImgChunkSet[k])want[k]=true;
  }
  for(var key in want)if(want.hasOwnProperty(key))loadImgChunk(+key);
}

function startLoading(fcIdx, imgIdx) {
  CATS = fcIdx.cats || [];
  totalChunks = fcIdx.chunks;
  totalModels = fcIdx.total || 0;
  totalImgChunks = imgIdx.chunks;
  loadChunk(0);
}

Promise.all([
  fetch('/data/fc-index.json').then(function(r){return r.json();}),
  fetch('/data/fc-img-index.json').then(function(r){return r.json();})
]).then(function(res){ startLoading(res[0], res[1]); })
  .catch(function(){
    if(statusText)statusText.textContent='Failed to load catalog. Please refresh.';
  });

// keepPage - не отматывать выдачу в начало. Нужно тем вызовам, которые не
// меняют условия отбора, а лишь пересобирают список после прихода куска.
function applyFilters(keepPage){
  if(!fcReady)return;
  // Номер выбранной категории считаем один раз, а не для каждой из 54 тысяч
  // строк: indexOf внутри цикла превратил бы фильтр в квадрат.
  var catIdx = selCat===null ? -1 : CATS.indexOf(selCat);
  filtered=[];
  for(var i=0;i<FC.n.length;i++){
    if(searchQ&&FC.n[i].toLowerCase().indexOf(searchQ)===-1)continue;
    if(catIdx>=0&&FC.g[i]!==catIdx)continue;
    if(onlyRigged&&!RIGGED.test(FC.n[i]))continue;
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
   * Обрезки выдачи больше нет: страницу целиком определяет номер страницы, и
   * в память попадает ровно сотня карточек, а не весь каталог. Раньше список
   * резался сотней насовсем - и каталог из 54 527 моделей заканчивался на
   * сотой карточке, хотя строка над сеткой обещала все 54 527.
   *
   * Листать можно только по загруженным строкам, поэтому за пределами первого
   * куска догружаем остальные - иначе на пятой странице выдача обрывалась бы
   * там, где кончился первый файл.
   */
  if(!keepPage){page=0;wantedPage=0;}
  // updateProgress() здесь больше не зовём: он внутри renderGrid. Снаружи он
  // отменял скрытие строки при нулевой выдаче - «Showing 0 of 0 models»
  // возвращалось прямо над надписью «No models found».
  renderGrid();
  updateStatus();
}

function renderGrid(){
  if(!grid||!fcReady)return;
  // Просили страницу, которой пока (или вовсе) нет - рисуем ближайшую
  // существующую. Иначе срез уходит за конец списка и сетка пуста.
  var last=Math.max(0,totalPages()-1);
  page=Math.min(wantedPage,last);
  // Ровно одна страница, а не всё от начала: сетка не растёт бесконечно.
  var toShow=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  /*
   * Страница есть, а строк под неё ещё нет: кусок каталога в пути. Прежнюю
   * сетку не стираем - иначе на секунду мигает пустота, будто ничего не
   * нашлось. Придёт кусок - loadChunk сам позовёт applyFilters и перерисует.
   */
  if(!toShow.length && filtered.length && loadedChunks<totalChunks) return;
  // Запрашиваем адреса картинок ровно для тех карточек, что сейчас выводим.
  // Пришедший файл сам подставит снимки на место рамок - injectLoadedImages.
  ensureImgChunksFor(toShow);
  if(filtered.length===0){
    grid.innerHTML='';
    /*
     * Блок «нет результатов» появляется ТОЛЬКО когда человек действительно
     * искал или фильтровал и не нашёл ничего.
     *
     * Раньше он лежал в разметке с атрибутом hidden. Для глаза его не было, а
     * в исходнике страницы под полусотней карточек стояло «No models found» и
     * «Showing 0 of 0 models». Обходчик, дерево доступности и любой разбор
     * разметки читали противоречие. Теперь блока в HTML нет вовсе: он
     * создаётся здесь и только по делу.
     */
    var searched=!!searchQ||selPrice!==null||selCat!==null||onlyRigged;
    if(searched){ var e=emptyBlock(); if(e)e.removeAttribute('hidden'); }
    else { var e0=document.getElementById('empty'); if(e0)e0.setAttribute('hidden',''); }
    renderPager(0);
    // При нуле результатов строка «Showing X of Y» врала бы прошлыми
    // числами прямо над надписью «No models found». Прячем её.
    var pg=document.getElementById('fc-progress');
    if(pg)pg.setAttribute('hidden','');
    return;
  }
  var eHide=document.getElementById('empty');
  if(eHide)eHide.setAttribute('hidden','');
  var html='';
  for(var i=0;i<toShow.length;i++)html+=modelCard(toShow[i]);
  grid.innerHTML=html;
  renderPager(totalPages());
  // Строку «Showing X of Y» обновляем здесь, а не у каждого, кто зовёт
  // renderGrid. Раньше её обновляли снаружи, и обработчик кнопки «Load more»
  // это делать забывал: после прокрутки поиска по слову helicopter на экране
  // лежали все 262 карточки, а строка упрямо повторяла «Showing 60 of 262».
  updateProgress();
}

/*
 * НАВИГАЦИЯ ПО СТРАНИЦАМ - один в один как в разделах категорий.
 *
 * Разметка и классы взяты оттуда без изменений (cat-pagination, cat-pg-link,
 * cat-pg-num, cat-pg-current, cat-pg-ellipsis), чтобы вид и поведение
 * совпадали: те же кнопки «Prev» и «Next», тот же чёрный номер текущей
 * страницы, то же многоточие между краями.
 *
 * Отличие одно и вынужденное: в категориях страницы - это отдельные адреса
 * /page/2/, а каталог живёт одной страницей на данных из кусков. Поэтому номер
 * едет параметром ?page=2. Ссылки настоящие, а не кнопки: их видно в строке
 * состояния, можно открыть в новой вкладке и отправить.
 */
function pageHref(n){
  var p=new URLSearchParams(location.search);
  if(n<=1)p.delete('page'); else p.set('page',String(n));
  var s=p.toString();
  return location.pathname+(s?'?'+s:'');
}

function renderPager(totalPages){
  var box=document.getElementById('fc-pager');
  if(!box){
    var wrap=grid&&grid.parentNode;
    if(!wrap)return;
    box=document.createElement('nav');
    box.id='fc-pager';
    box.className='cat-pagination';
    box.setAttribute('aria-label','Catalog pages');
    wrap.appendChild(box);
  }
  // Одна страница - листать нечего, и полоса кнопок только мешает.
  if(totalPages<2){box.hidden=true;box.innerHTML='';return;}
  box.hidden=false;
  var cur=page+1;
  // Какие номера показываем: края и окно вокруг текущей - как в категориях.
  var nums=[];
  var add=function(n){if(n>=1&&n<=totalPages&&nums.indexOf(n)<0)nums.push(n);};
  add(1);add(2);
  for(var d=-1;d<=1;d++)add(cur+d);
  add(totalPages-1);add(totalPages);
  nums.sort(function(a,b){return a-b;});
  var html='<div class="max-w-7xl mx-auto">';
  html+=cur>1
    ?'<a href="'+pageHref(cur-1)+'" class="cat-pg-link" rel="prev" data-pg="'+(cur-1)+'">&#8592; Prev</a>'
    :'<span class="cat-pg-link cat-pg-disabled">&#8592; Prev</span>';
  var prev=0;
  for(var i=0;i<nums.length;i++){
    var n=nums[i];
    if(prev&&n>prev+1)html+='<span class="cat-pg-ellipsis">&#8230;</span>';
    html+=n===cur
      ?'<span class="cat-pg-num cat-pg-current" aria-current="page">'+n+'</span>'
      :'<a href="'+pageHref(n)+'" class="cat-pg-num" data-pg="'+n+'">'+n+'</a>';
    prev=n;
  }
  html+=cur<totalPages
    ?'<a href="'+pageHref(cur+1)+'" class="cat-pg-link" rel="next" data-pg="'+(cur+1)+'">Next &#8594;</a>'
    :'<span class="cat-pg-link cat-pg-disabled">Next &#8594;</span>';
  box.innerHTML=html+'</div>';
}

// Переход по номеру перехватываем: перезагружать страницу ради смены сотни
// карточек незачем - данные уже в памяти. Адрес при этом всё равно меняем,
// чтобы «назад» возвращал на прежнюю страницу.
document.addEventListener('click',function(e){
  var a=e.target.closest?e.target.closest('#fc-pager a[data-pg]'):null;
  if(!a)return;
  if(e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;   // открыть в новой вкладке
  e.preventDefault();
  wantedPage=Math.max(0,parseInt(a.getAttribute('data-pg'),10)-1);
  ensureChunkForPage(wantedPage);
  history.pushState({page:wantedPage},'',a.getAttribute('href'));
  renderGrid();
  var top=document.getElementById('model-grid');
  if(top)window.scrollTo({top:top.getBoundingClientRect().top+window.pageYOffset-90,behavior:'smooth'});
});

// Кнопка «назад» должна возвращать на прежнюю страницу каталога, а не уводить
// с него: номер живёт в адресе, значит и восстанавливать его надо оттуда.
window.addEventListener('popstate',function(){
  var n=parseInt(new URLSearchParams(location.search).get('page')||'1',10);
  wantedPage=Math.max(0,(isNaN(n)?1:n)-1);
  ensureChunkForPage(wantedPage);
  renderGrid();
});

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
  /*
   * «X of Y» имеет смысл только когда что-то отобрано. Без фильтров подходит
   * весь каталог, и строка выходила «54,527 of 54,527 models» - а до правки
   * и вовсе «100 of 54527», где сотня была не числом найденного, а размером
   * первой выдачи. Поэтому без фильтров пишем просто «54,527 models».
   */
  var filtering = !!searchQ || selCat !== null || selPrice !== null || onlyRigged;
  if(resultCount){
    resultCount.innerHTML = filtering
      ? '<strong>'+filtered.length.toLocaleString('en-US')+'</strong> of '+total.toLocaleString('en-US')+' models'
      : '<strong>'+total.toLocaleString('en-US')+'</strong> models';
  }
  if(statusText)statusText.textContent='';
}

if(qEl){
  var debT=null;
  qEl.addEventListener('input',function(){
    clearTimeout(debT);var val=this.value.trim();
    debT=setTimeout(function(){
      searchQ=val.toLowerCase();
      applyFilters();
      if(val.length>1){ensureRemainingChunks();}
    },220);
  });
}
if(sortSel)sortSel.addEventListener('change',function(){sortMode=this.value;ensureRemainingChunks();applyFilters();});
if(clearAll)clearAll.addEventListener('click',function(){
  searchQ='';selPrice=null;selCat=null;onlyRigged=false;
  if(qEl)qEl.value='';
  document.querySelectorAll('.ftag').forEach(function(b){b.classList.remove('active');});
  clearAll.classList.remove('show');
  applyFilters();
});
// Кнопки «Load more» больше нет: каталог листается страницами, см. renderPager.

document.querySelectorAll('.ftag[data-price]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var pr=this.dataset.price;
    if(selPrice===pr){selPrice=null;this.classList.remove('active');}
    else{document.querySelectorAll('.ftag[data-price]').forEach(function(b){b.classList.remove('active');});selPrice=pr;this.classList.add('active');}
    if(clearAll)clearAll.classList.toggle('show',selPrice!==null||selCat!==null||!!searchQ);
    if(typeof gtag==='function')gtag('event','filter_price',{price_band:selPrice||'none',page_type:'catalog'});
    ensureRemainingChunks();applyFilters();
  });
});
// Кнопка «с оснасткой». Одна, включается и выключается щелчком.
document.querySelectorAll('.ftag[data-rigged]').forEach(function(btn){
  btn.addEventListener('click',function(){
    onlyRigged=!onlyRigged;
    this.classList.toggle('active',onlyRigged);
    if(clearAll)clearAll.classList.toggle('show',selPrice!==null||selCat!==null||!!searchQ||onlyRigged);
    if(typeof gtag==='function')gtag('event','filter_rigged',{value:onlyRigged?'on':'off',page_type:'catalog'});
    ensureRemainingChunks();applyFilters();
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
    ensureRemainingChunks();applyFilters();
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


// Бесконечной прокрутки больше нет: она была обратной стороной кнопки «Load
// more» - лента росла без конца, и вернуться к уже виденному было нельзя.
// Теперь страницы перелистываются, см. renderPager.

function updateProgress() {
  /*
   * Строка «Showing X of Y» СОЗДАЁТСЯ здесь, а не лежит в разметке скрытой.
   *
   * Раньше она стояла в HTML как «Showing 0 of 0 models» с атрибутом hidden.
   * Для глаза её не было, но исходник страницы говорил: 54 527 моделей,
   * полсотни карточек - и тут же «0 of 0». Всё, что читает разметку, а не
   * картинку - обходчик, дерево доступности, любой разбор страницы - видело
   * противоречие. Скрытое неверное утверждение остаётся неверным.
   *
   * Числа известны только после того, как данные пришли и фильтр отработал.
   * Значит и строка должна появляться тогда же.
   */
  var prog = document.getElementById('fc-progress');
  if (!prog) {
    var grid = document.getElementById('model-grid');
    if (!grid || !grid.parentNode) return;
    prog = document.createElement('div');
    prog.id = 'fc-progress';
    prog.className = 'fc-progress';
    prog.appendChild(document.createTextNode('Showing '));
    var s = document.createElement('span'); s.id = 'fc-shown'; prog.appendChild(s);
    prog.appendChild(document.createTextNode(' of '));
    var t = document.createElement('span'); t.id = 'fc-total'; prog.appendChild(t);
    prog.appendChild(document.createTextNode(' models'));
    grid.parentNode.insertBefore(prog, grid.nextSibling);
  }
  prog.removeAttribute('hidden');
  // На странице лежит ДИАПАЗОН карточек, а не первые N: «Showing 101-200 of
  // 54,527». Одно число здесь врало бы - на третьей странице «Showing 300»
  // означало бы, что все триста на экране, а их сто.
  // Итог берём тот же, что и навигация: без фильтров это весь каталог из
  // fc-index.json, а не длина загруженных кусков. Иначе внизу стояло
  // «of 20,000», пока навигация обещала 546 страниц.
  var total = plainOrder() ? (totalModels || filtered.length) : filtered.length;
  var from = total ? page * PAGE_SIZE + 1 : 0;
  var to = Math.min((page + 1) * PAGE_SIZE, total);
  // Язык обязателен - см. комментарий у totalModels выше. Без него у русского
  // посетителя выходит «54 079» с неразрывными пробелами вместо запятых.
  document.getElementById('fc-shown').textContent =
    from.toLocaleString('en-US') + '-' + to.toLocaleString('en-US');
  document.getElementById('fc-total').textContent = total.toLocaleString('en-US');
}

/*
 * Блок «ничего не найдено» - тоже создаётся, и только когда поиск
 * действительно ничего не дал. В разметке его нет: страница, на которой
 * лежат карточки, не должна одновременно утверждать, что моделей нет.
 */
function emptyBlock() {
  var el = document.getElementById('empty');
  if (el) return el;
  var grid = document.getElementById('model-grid');
  if (!grid || !grid.parentNode) return null;
  el = document.createElement('div');
  el.id = 'empty';
  var ic = document.createElement('div'); ic.className = 'ei'; ic.textContent = '🔍';
  var t = document.createElement('p'); t.className = 'empty-title'; t.setAttribute('role', 'status');
  t.textContent = 'No models found';
  var h = document.createElement('p'); h.textContent = 'Try a different search term or clear filters';
  el.appendChild(ic); el.appendChild(t); el.appendChild(h);
  grid.parentNode.insertBefore(el, grid.nextSibling);
  return el;
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
