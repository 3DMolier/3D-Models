(function(){
'use strict';

var CATALOG_URL='/data/catalog.json';
var FC_INDEX_URL='/data/fc-index.json';
var FC_CHUNK_BASE='/data/fc-chunk-';
var FC_IMG_CHUNK_BASE='/data/fc-img-chunk-';
// Здесь стояло FC_IMG_CHUNKS=6 с пометкой «в чанках 0-5 реальные данные».
// Каталог дорос до 18 чанков, и у двух третей результатов картинка не
// находилась. Номер нужного чанка теперь приезжает вместе с моделью (ic).
var PAGE_SIZE=24;

var PAGES=[{"type":"category","title":"Vehicles","page":"/categories/vehicles/","icon":"🚗","count":292},{"type":"category","title":"Aircraft","page":"/categories/aircraft/","icon":"✈️","count":173},{"type":"category","title":"Military Vehicles","page":"/categories/military-vehicles/","icon":"🪖","count":79},{"type":"category","title":"Ships","page":"/categories/ships/","icon":"⚓","count":64},{"type":"category","title":"Medical","page":"/categories/medical-3d-models/","icon":"🧬","count":101},{"type":"category","title":"Industrial Equipment","page":"/categories/industrial-equipment/","icon":"⚙️","count":34},{"type":"category","title":"Architecture Landmarks","page":"/categories/architecture-landmarks/","icon":"🏛️","count":57},{"type":"category","title":"Characters & People","page":"/categories/characters-people/","icon":"👤","count":4},{"type":"category","title":"Animals & Creatures","page":"/categories/animals-creatures/","icon":"🐾","count":13},{"type":"category","title":"Nature & Plants","page":"/categories/nature-plants/","icon":"🌿","count":18},{"type":"category","title":"Furniture & Interior","page":"/categories/furniture-interior/","icon":"🪑","count":8},{"type":"category","title":"Electronics & Gadgets","page":"/categories/electronics-gadgets/","icon":"💻","count":10},{"type":"category","title":"Clothing & Accessories","page":"/categories/clothing-accessories/","icon":"👗","count":12},{"type":"category","title":"Food & Beverages","page":"/categories/food-beverages/","icon":"🍕","count":4},{"type":"category","title":"Other","page":"/categories/other/","icon":"📦","count":131},{"type":"collection","title":"Architecture Collections","page":"/collections/architecture/","icon":"🏛️"},{"type":"collection","title":"Art, Office & Music Collections","page":"/collections/art-media/","icon":"🎼"},{"type":"collection","title":"Character Collections","page":"/collections/characters/","icon":"👤"},{"type":"collection","title":"Currency & Symbol Collections","page":"/collections/currency-symbols/","icon":"💰"},{"type":"collection","title":"Fashion Collections","page":"/collections/fashion/","icon":"👗"},{"type":"collection","title":"Food & Drink Collections","page":"/collections/food-drink/","icon":"🍽️"},{"type":"collection","title":"Holiday Collections","page":"/collections/holidays/","icon":"🎁"},{"type":"collection","title":"Home & Interior Collections","page":"/collections/home-interior/","icon":"🛋️"},{"type":"collection","title":"Industrial Collections","page":"/collections/industrial/","icon":"⚙️"},{"type":"collection","title":"Nature Collections","page":"/collections/nature/","icon":"🌿"},{"type":"collection","title":"Science & Medical Collections","page":"/collections/science-medical/","icon":"🔬"},{"type":"collection","title":"Sports Collections","page":"/collections/sports/","icon":"⚽"},{"type":"collection","title":"Technology Collections","page":"/collections/technology/","icon":"💻"},{"type":"collection","title":"Toys & Games Collections","page":"/collections/toys-games/","icon":"🧸"},{"type":"collection","title":"Vehicle Collections","page":"/collections/vehicles/","icon":"🚗"},{"type":"collection","title":"Weapon Collections","page":"/collections/weapons/","icon":"🗡️"},{"type":"industry","title":"Aerospace","icon":"✈️","page":"/industries/aerospace/"},{"type":"industry","title":"Military & Defense","icon":"🪖","page":"/industries/military-defense/"},{"type":"industry","title":"Medical","icon":"🏥","page":"/industries/medical/"},{"type":"industry","title":"Game Development","icon":"🎮","page":"/industries/game-development/"},{"type":"industry","title":"Film Production","icon":"🎬","page":"/industries/film-video-production/"},{"type":"industry","title":"Architecture","icon":"🏛️","page":"/industries/architecture/"},{"type":"industry","title":"Virtual Reality","icon":"🥽","page":"/industries/virtual-reality/"},{"type":"industry","title":"Advertising","icon":"📢","page":"/industries/advertising/"},{"type":"industry","title":"Software Development","icon":"💻","page":"/industries/software-development/"},{"type":"industry","title":"Event Management","icon":"🎪","page":"/industries/event-management/"},{"type":"industry","title":"Hardware","icon":"⚙️","page":"/industries/hardware/"},{"type":"industry","title":"3D Printing","icon":"🖨️","page":"/industries/3d-printing/"}];

// ── Разбор запроса ─────────────────────────────────────────────────────────
// Раньше поиск был одним indexOf по названию. Значит «black hawk helicopter»
// находило только модели, где эти три слова стоят подряд и именно в таком
// порядке, а «helicoter» с опечаткой не находило ничего. Теперь запрос
// разбирается на слова, каждое ищется отдельно, и подходящей считается
// модель, в названии которой есть все слова - в любом порядке.

// Слова, которыми люди называют одно и то же. Список рукописный и намеренно
// короткий: синоним, добавленный наугад, портит выдачу сильнее, чем его
// отсутствие. Внутри группы слова равнозначны в обе стороны.
var SYN_GROUPS=[
  ['car','automobile','vehicle','auto'],
  ['plane','airplane','aircraft','aeroplane','jet'],
  ['chopper','helicopter','heli'],
  ['boat','ship','vessel'],
  ['gun','firearm','weapon','rifle'],
  ['sofa','couch','settee'],
  ['fridge','refrigerator'],
  ['tv','television'],
  ['phone','smartphone','cellphone'],
  ['pc','computer','desktop'],
  ['notebook','laptop'],
  ['bike','bicycle'],
  ['motorbike','motorcycle'],
  ['lorry','truck'],
  ['human','person','people','character'],
  ['skeleton','bone','anatomy'],
  ['medicine','medical','hospital','clinic'],
  ['army','military','soldier'],
  ['drone','uav','quadcopter'],
  ['lamp','light','lighting'],
  ['jewellery','jewelry'],
  ['armour','armor'],
  ['colour','color'],
  ['tyre','tire'],
];
var SYN={};
SYN_GROUPS.forEach(function(g){
  g.forEach(function(w){
    SYN[w]=(SYN[w]||[]).concat(g.filter(function(x){return x!==w;}));
  });
});

function normQ(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9\s-]+/g,' ').replace(/\s+/g,' ').trim();
}
function toTokens(s){
  // Слова короче двух букв выбрасываем: они совпадают почти со всем.
  return normQ(s).split(' ').filter(function(t){return t.length>1;});
}

// Словарь слов каталога - для опечаток и подсказок. Строится один раз после
// загрузки чанков: перебирать 54 тысячи названий на каждое нажатие клавиши
// нельзя.
var VOCAB=[], VOCAB_SET=null, VOCAB_COUNT=Object.create(null);
function buildVocab(){
  var counts=Object.create(null);
  for(var i=0;i<FC_MODELS.length;i++){
    var t=toTokens(FC_MODELS[i].n);
    for(var j=0;j<t.length;j++)counts[t[j]]=(counts[t[j]]||0)+1;
  }
  VOCAB=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});
  VOCAB_SET=new Set(VOCAB);
  VOCAB_COUNT=counts;
}

// Расстояние Левенштейна с потолком: как только ясно, что правок больше
// допустимого, считать дальше незачем.
function editWithin(a,b,max){
  var la=a.length, lb=b.length;
  if(Math.abs(la-lb)>max)return false;
  var prev=new Array(lb+1), cur=new Array(lb+1), i, j;
  for(j=0;j<=lb;j++)prev[j]=j;
  for(i=1;i<=la;i++){
    cur[0]=i;
    var best=cur[0];
    for(j=1;j<=lb;j++){
      var cost=a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
      if(cur[j]<best)best=cur[j];
    }
    if(best>max)return false;
    var tmp=prev;prev=cur;cur=tmp;
  }
  return prev[lb]<=max;
}

// Сколько правок прощаем. Коротким словам - ни одной: у слова из трёх букв
// одна правка меняет смысл целиком («car» -> «cat»).
function tolerance(w){ return w.length>=7?2:w.length>=5?1:0; }

// Варианты одного слова запроса: оно само, синонимы и - если такого слова в
// каталоге нет вовсе - похожие слова из словаря. Похожие ищем только для
// отсутствующих: иначе «car» притащит «care», «card» и «cart» к точному слову.
function expandToken(t){
  var out=[t];
  if(SYN[t])out=out.concat(SYN[t]);
  if(VOCAB_SET&&!VOCAB_SET.has(t)){
    var tol=tolerance(t);
    if(tol>0){
      var found=[];
      for(var i=0;i<VOCAB.length&&found.length<6;i++){
        var w=VOCAB[i];
        if(Math.abs(w.length-t.length)>tol)continue;
        if(editWithin(t,w,tol))found.push(w);
      }
      out=out.concat(found);
    }
  }
  return out;
}

// Совпадение и оценка. Оценка нужна, чтобы вверх шло то, что человек скорее
// всего искал: точное название, потом начало названия, потом слова целиком,
// и только потом совпадения внутри слов и исправленные опечатки.
function scoreName(ln,parsed,ql){
  if(!ln)return 0;
  var score=0;
  for(var i=0;i<parsed.length;i++){
    var variants=parsed[i], hit=0;
    for(var v=0;v<variants.length;v++){
      var w=variants[v];
      var pos=ln.indexOf(w);
      if(pos<0)continue;
      var wholeWord=(pos===0||!/[a-z0-9]/.test(ln.charAt(pos-1)));
      var s=v===0?(wholeWord?6:3):(wholeWord?4:2);
      if(s>hit)hit=s;
    }
    if(!hit)return 0;      // нет хотя бы одного слова запроса - не подходит
    score+=hit;
  }
  if(ln===ql)score+=100;
  else if(ln.indexOf(ql)===0)score+=40;
  else if(ln.indexOf(ql)>-1)score+=15;
  return score;
}

// ── State ──────────────────────────────────────────────────────────────────
var MODELS=[], catalogReady=false;
var FC_MODELS=[], fcImgMap={}, fcReady=false, fcLoading=false;
var FC_CATS=[];
var topIdSet=new Set();
var lastQ='', debT=null, activeFilter='all';
var currentTopResults=[], currentFcResults=[], renderedTop=0, renderedFc=0;

// ── DOM refs ───────────────────────────────────────────────────────────────
var qEl=document.getElementById('q');
var clearBtn=document.getElementById('clear-q');
var resultsEl=document.getElementById('results');
var hintState=document.getElementById('hint-state');
var emptyState=document.getElementById('empty-state');
var tsLink=document.getElementById('ts-search-link');
var statusEl=document.getElementById('search-status');
var countEl=document.getElementById('result-count');
var showMoreBtn=document.getElementById('show-more');

// ── Status ─────────────────────────────────────────────────────────────────
function setStatus(msg){
  if(!statusEl)return;
  statusEl.textContent=msg||'';
  statusEl.hidden=!msg;
}

// ── URL sync ───────────────────────────────────────────────────────────────
function updateUrl(q){
  var url=new URL(window.location.href);
  if(q)url.searchParams.set('q',q);
  else url.searchParams.delete('q');
  window.history.replaceState({},'',url.toString());
}

// ── Helpers ────────────────────────────────────────────────────────────────
function certBadge(cert){
  if(!cert||cert==='no certification')return '';
  if(cert.indexOf('CheckMate')>-1)return '<span class="s-cert cm-b">CheckMate</span>';
  if(cert.indexOf('StemCell')>-1)return '<span class="s-cert sc-b">StemCell</span>';
  return '';
}
function certBadgeCode(c){
  if(c===2)return '<span class="s-cert cm-b">CheckMate</span>';
  if(c===1)return '<span class="s-cert sc-b">StemCell</span>';
  return '';
}
function getTsId(slug){
  var m=String(slug||'').match(/-(\d+)$/);
  return m?m[1]:'';
}

// ── Error state ────────────────────────────────────────────────────────────
function showDataError(){
  if(hintState)hintState.style.display='none';
  if(showMoreBtn)showMoreBtn.hidden=true;
  if(countEl)countEl.textContent='';
  if(!resultsEl)return;
  resultsEl.innerHTML='<div class="search-warning" role="status">'
    +'<h2>Search data is temporarily unavailable</h2>'
    +'<p>Model search data could not be loaded. You can browse the Full Catalog or search TurboSquid directly.</p>'
    +'<div class="search-warning-actions">'
    +'<a class="btn-primary" href="/full-catalog/">Open Full Catalog</a>'
    +'<a class="btn-ghost" href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-international" target="_blank" rel="noopener">Search on TurboSquid ↗</a>'
    +'</div></div>';
}

// ── Load catalog.json (featured slice) ───────────────────────────────────────────
setStatus('Loading search index…');
fetch(CATALOG_URL)
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(d){
    MODELS=Array.isArray(d)?d:[];
    MODELS.forEach(function(m){
      var id=getTsId(m.s||'');
      if(id)topIdSet.add(Number(id));
    });
    catalogReady=true;
    setStatus('');
    if(lastQ.length>1)runSearch(lastQ);
  })
  .catch(function(err){
    catalogReady=false;
    setStatus('');
    showDataError();
    console.warn('Search data load error:',err);
  });

// ── Load FC chunks (86K full catalog) ─────────────────────────────────────
function loadFcData(){
  if(fcReady||fcLoading)return;
  fcLoading=true;
  setStatus('Loading full catalog…');

  var p1=fetch(FC_INDEX_URL)
    .then(function(r){return r.json();})
    .then(function(idx){
      FC_CATS=idx.cats||[];
      var fetches=[];
      for(var i=0;i<idx.chunks;i++){
        fetches.push(fetch(FC_CHUNK_BASE+i+'.json').then(function(r){return r.json();}));
      }
      return Promise.all(fetches);
    })
    .then(function(chunks){
      FC_MODELS=[];
      chunks.forEach(function(ch){
        for(var i=0;i<ch.i.length;i++){
          var id=ch.i[i];
          if(!topIdSet.has(id)){
            // ln - название в нижнем регистре, посчитанное один раз. Раньше
            // toLowerCase звался для всех 54 тысяч названий на каждый запрос.
            // g - номер категории, чтобы показать её в выдаче.
            // ic - номер файла с картинкой этой модели. Без него пришлось бы
            // грузить все 18 картиночных чанков, а это 19 МБ.
            FC_MODELS.push({id:id,n:ch.n[i],ln:String(ch.n[i]||'').toLowerCase(),p:ch.p[i],c:ch.c[i],g:ch.g?ch.g[i]:-1,ic:ch.ic?ch.ic[i]:-1});
          }
        }
      });
      buildVocab();
    });

  // Картинки больше не грузим пачкой вперёд. Раньше здесь брались первые шесть
  // чанков из восемнадцати, и у двух третей результатов картинки не было.
  Promise.all([p1])
    .then(function(){
      fcReady=true;
      fcLoading=false;
      setStatus('');
      if(lastQ.length>1)runSearch(lastQ);
    })
    .catch(function(err){
      fcLoading=false;
      setStatus('');
      console.warn('FC data load error:',err);
    });
}

// ── Картинки по требованию ─────────────────────────────────────────────────
// Грузим только те картиночные файлы, в которых лежат показанные сейчас
// модели: их номера приехали вместе с каталогом (колонка ic). На страницу
// выдачи это обычно один-три файла вместо восемнадцати.
var imgChunkLoaded={}, imgChunkPending={};
function ensureImgChunks(list){
  var need={};
  for(var i=0;i<list.length;i++){
    var k=list[i]&&list[i].ic;
    if(k>=0&&!imgChunkLoaded[k])need[k]=true;
  }
  var jobs=Object.keys(need).map(function(k){
    if(imgChunkPending[k])return imgChunkPending[k];
    var pr=fetch(FC_IMG_CHUNK_BASE+k+'.json')
      .then(function(r){return r.json();})
      .then(function(ch){
        Object.keys(ch).forEach(function(id){fcImgMap[Number(id)]=ch[id];});
        imgChunkLoaded[k]=true;
      })
      .catch(function(){ /* нет файла - останется рамка-заглушка */ });
    imgChunkPending[k]=pr;
    return pr;
  });
  return Promise.all(jobs);
}

// Дорисовываем картинки в уже показанные карточки, не перерисовывая выдачу:
// перерисовка сбросила бы прокрутку.
function fillImages(){
  var phs=document.querySelectorAll('.s-mc-ph[data-img-pid]');
  for(var i=0;i<phs.length;i++){
    var ph=phs[i], src=fcImgMap[Number(ph.dataset.imgPid)];
    if(!src)continue;
    var img=new Image();
    img.src=src; img.alt=ph.dataset.imgAlt||'';
    img.width=800; img.height=450;
    img.loading='lazy'; img.decoding='async';
    img.onerror=function(){this.style.display='none';};
    ph.parentNode.replaceChild(img,ph);
  }
}

// ── Hint categories ────────────────────────────────────────────────────────
var hintCats=document.getElementById('hint-cats');
if(hintCats){
  var cats=PAGES.filter(function(p){return p.type==='category';});
  hintCats.innerHTML=cats.map(function(c){
    return '<a href="'+c.page+'" class="hint-cat"><span class="icon">'+c.icon+'</span>'+c.title+'</a>';
  }).join('');
}

// ── Popular searches ───────────────────────────────────────────────────────
function bindPopularSearches(){
  document.querySelectorAll('.search-tag').forEach(function(btn){
    btn.addEventListener('click',function(){
      var q=this.textContent.trim();
      if(qEl)qEl.value=q;
      if(clearBtn)clearBtn.classList.add('show');
      updateUrl(q);
      runSearch(q);
    });
  });
}

// ── Card: model with a local page ─────────────────────────────────
function modelCard(m){
  var slug=m.s||'';
  var localUrl='/models/'+slug+'/';
  var id=getTsId(slug);
  var tsUrl=id
    ?'https://www.turbosquid.com/FullPreview/'+id+'?referral=3d_molier-international'
    :'https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-international';
  var src=m.img||'';
  var nameEsc=String(m.n||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var nameHtml=String(m.n||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  var imgTag=src
    ?'<img src="'+src+'" alt="'+nameEsc+' 3D model" width="800" height="450" loading="lazy" decoding="async" onerror="handleImageError(this)">'
    :'<div class="s-mc-ph">📷</div>';
  return '<article class="s-mc">'
    +'<a href="'+localUrl+'" class="s-mc-img-link" aria-label="View '+nameEsc+' 3D Model">'
    +imgTag+certBadge(m.cert)
    +'</a>'
    +'<div class="s-mc-body">'
    +'<div class="s-mc-cat">'+String(m.c||'').replace(/&/g,'&amp;')+'</div>'
    +'<h3 class="s-mc-title"><a href="'+localUrl+'">'+nameHtml+'</a></h3>'
    +'<div class="s-mc-meta"><span class="s-mc-price">$'+m.p+'</span></div>'
    +'<div class="s-mc-actions">'
    +'<a href="'+localUrl+'" class="btn-ghost btn-ghost--sm">View Details</a>'
    +'<a href="'+tsUrl+'" class="btn-primary btn-primary--sm" target="_blank" rel="noopener">TurboSquid ↗</a>'
    +'</div>'
    +'</div>'
    +'</article>';
}

// ── Card: full-catalog model (TurboSquid link only) ───────────────────────
// Адрес нашей карточки строим тем же правилом, что и сетка каталога. Правило
// проверено на всех 54 079 записях: для каждой получившийся адрес совпадает с
// существующей папкой. Раньше вся выдача по каталогу вела прямо на TurboSquid
// мимо наших же страниц - человек уходил с сайта на первом же клике, а мы
// теряли и просмотр карточки, и её перелинковку.
function fcLocalUrl(fc){
  var s=String(fc.n||'').toLowerCase().trim()
    .replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'');
  return s?('/models/'+s+'-'+fc.id+'/'):'';
}

function modelCardFull(fc){
  var tsUrl='https://www.turbosquid.com/FullPreview/'+fc.id+'?referral=3d_molier-international';
  var url=fcLocalUrl(fc)||tsUrl;
  var local=url!==tsUrl;
  var linkAttrs=local?'':' target="_blank" rel="noopener"';
  var src=fcImgMap[fc.id]||'';
  var nameEsc=String(fc.n||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var nameHtml=String(fc.n||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  var imgTag=src
    ?'<img src="'+src+'" alt="'+nameEsc+' 3D model" width="800" height="450" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    // Заглушку помечаем номером модели: когда нужный картиночный файл
    // догрузится, картинка встанет на место без перерисовки всей выдачи.
    :'<div class="s-mc-ph" data-img-pid="'+fc.id+'" data-img-alt="'+nameEsc+' 3D model">&#128247;</div>';
  // Категорию показываем рядом с ценой: по названию не всегда понятно, к чему
  // модель относится, а теперь эти данные у поиска есть.
  var catName=(fc.g>=0&&FC_CATS[fc.g])?FC_CATS[fc.g].replace(/-3d-models$/,'').replace(/-/g,' '):'';
  var catHtml=catName?'<span class="s-mc-cat">'+catName.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>':'';
  return '<article class="s-mc">'
    +'<a href="'+url+'" class="s-mc-img-link"'+linkAttrs+' aria-label="'+(local?'Open ':'View ')+nameEsc+(local?'':' on TurboSquid')+'">'
    +imgTag+certBadgeCode(fc.c)
    +'</a>'
    +'<div class="s-mc-body">'
    +'<h3 class="s-mc-title"><a href="'+url+'"'+linkAttrs+'>'+nameHtml+'</a></h3>'
    +'<div class="s-mc-meta"><span class="s-mc-price">$'+fc.p+'</span>'+catHtml+'</div>'
    +'<div class="s-mc-actions">'
    +(local?'<a href="'+url+'" class="btn-primary btn-primary--sm">View model</a>':'')
    +'<a href="'+tsUrl+'" class="btn-ghost btn-primary--sm" target="_blank" rel="noopener">TurboSquid &#8599;</a>'
    +'</div>'
    +'</div>'
    +'</article>';
}

// ── Pagination ─────────────────────────────────────────────────────────────
function totalResults(){return currentTopResults.length+currentFcResults.length;}
function renderedTotal(){return renderedTop+renderedFc;}

function updateCount(){
  if(!countEl)return;
  var total=totalResults();
  if(!total){countEl.textContent='';return;}
  var shown=renderedTotal();
  var suffix=fcLoading?' (loading more…)':'';
  countEl.textContent='Showing '+Math.min(shown,total)+' of '+total+' model'+(total===1?'':' result'+(total===1?'':'s'))+suffix;
}

function updateShowMore(){
  if(!showMoreBtn)return;
  showMoreBtn.hidden=renderedTotal()>=totalResults();
}

function appendModelCards(){
  var grid=document.getElementById('model-results');
  if(!grid)return;
  // Fill from top results first, then fc results
  var toAdd=PAGE_SIZE;
  if(renderedTop<currentTopResults.length){
    var slice=currentTopResults.slice(renderedTop,renderedTop+toAdd);
    grid.insertAdjacentHTML('beforeend',slice.map(modelCard).join(''));
    renderedTop+=slice.length;
    toAdd-=slice.length;
  }
  if(toAdd>0&&renderedFc<currentFcResults.length){
    var slice2=currentFcResults.slice(renderedFc,renderedFc+toAdd);
    grid.insertAdjacentHTML('beforeend',slice2.map(modelCardFull).join(''));
    renderedFc+=slice2.length;
    // Догружаем картинки ровно для этой порции карточек.
    ensureImgChunks(slice2).then(fillImages);
  }
  updateCount();
  updateShowMore();
}

// ── Hint / empty ───────────────────────────────────────────────────────────
function showHint(){
  if(hintState)hintState.style.display='';
  if(emptyState){emptyState.hidden=true;emptyState.style.display='none'};
  if(countEl)countEl.textContent='';
  if(showMoreBtn)showMoreBtn.hidden=true;
  if(resultsEl)resultsEl.innerHTML='';
  currentTopResults=[];currentFcResults=[];renderedTop=0;renderedFc=0;
}

// ── Render ─────────────────────────────────────────────────────────────────
function render(pages,topModels,fcModels,q){
  if(hintState)hintState.style.display='none';
  var total=topModels.length+fcModels.length;
  if(pages.length===0&&total===0&&!fcLoading){
    if(emptyState){emptyState.hidden=false;emptyState.style.display='block'};
    if(tsLink)tsLink.href='https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-international';
    if(countEl)countEl.textContent='';
    if(showMoreBtn)showMoreBtn.hidden=true;
    if(resultsEl)resultsEl.innerHTML='';
    return;
  }
  if(emptyState){emptyState.hidden=true;emptyState.style.display='none'};
  var html='';
  if(pages.length>0){
    html+='<div class="result-section">';
    html+='<div class="section-header"><span class="section-title">Pages</span><span class="section-count">'+pages.length+'</span></div>';
    html+='<div class="meta-grid">';
    pages.forEach(function(item){
      html+='<a href="'+item.page+'" class="meta-card">';
      html+='<div class="meta-icon" style="background:#f5f5f5">'+item.icon+'</div>';
      html+='<div class="meta-body"><div class="meta-type">'+item.type+'</div>';
      html+='<div class="meta-title">'+item.title+'</div>';
      if(item.count)html+='<div class="meta-count">'+item.count+' models</div>';
      html+='</div></a>';
    });
    html+='</div></div>';
  }
  if(total>0||fcLoading){
    var headerCount=total>0?(' <span class="section-count">'+total+(fcLoading?'+':'')+'</span>'):'';
    html+='<div class="result-section">';
    html+='<div class="section-header">';
    html+='<span class="section-title">Models'+headerCount+'</span>';
    if(!fcLoading&&fcReady){
      html+='<a href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-international" target="_blank" rel="noopener" style="color:#1659c9;text-decoration:none;font-size:11px;font-weight:600">more on TurboSquid →</a>';
    }
    html+='</div>';
    if(fcLoading){
      html+='<div style="font-size:13px;color:#6b7280;padding:8px 0;">Searching the full catalog…</div>';
    }
    html+='<div class="s-mc-grid" id="model-results"></div>';
    html+='</div>';
  }
  if(resultsEl)resultsEl.innerHTML=html;
  if(total>0){
    renderedTop=0;renderedFc=0;
    appendModelCards();
  }
}

// ── Search ─────────────────────────────────────────────────────────────────
function runSearch(q){
  lastQ=q;
  if(!q||q.length<2){showHint();return;}
  var ql=normQ(q);
  // Слова запроса и их варианты считаем один раз на запрос, а не на модель:
  // подбор похожих слов идёт по всему словарю и внутри цикла был бы неподъёмным.
  var toks=toTokens(q);
  var parsed=toks.map(expandToken);
  if(!parsed.length)parsed=[[ql]];

  var pages=PAGES.filter(function(x){
    if(activeFilter!=='all'&&x.type!==activeFilter)return false;
    return scoreName(x.title.toLowerCase(),parsed,ql)>0;
  });

  var topModels=[];
  if(catalogReady&&(activeFilter==='all'||activeFilter==='model')){
    for(var i=0;i<MODELS.length;i++){
      var m=MODELS[i];
      var sm=Math.max(
        scoreName((m.n||'').toLowerCase(),parsed,ql),
        scoreName((m.c||'').toLowerCase(),parsed,ql),
        scoreName((m.s||'').toLowerCase(),parsed,ql));
      if(sm>0){m._sc=sm;topModels.push(m);}
    }
    topModels.sort(function(a,b){return b._sc-a._sc;});
  }

  var fcResults=[];
  if(fcReady&&(activeFilter==='all'||activeFilter==='model')){
    for(var j=0;j<FC_MODELS.length;j++){
      var fc=FC_MODELS[j];
      var sf=scoreName(fc.ln,parsed,ql);
      if(sf>0){fc._sc=sf;fcResults.push(fc);}
    }
    // Сортируем по оценке, при равной - по цене: дешёвое выше не потому, что
    // лучше, а чтобы порядок был устойчивым и не прыгал между запросами.
    fcResults.sort(function(a,b){return (b._sc-a._sc)||(a.p-b.p);});
  }

  currentTopResults=topModels;
  currentFcResults=fcResults;
  renderedTop=0;renderedFc=0;
  render(pages,topModels,fcResults,q);

  // Что ищут и что НЕ находят. Пустая выдача - самое ценное событие из всех:
  // это прямой список того, чего людям на сайте не хватает. Отправляем только
  // когда каталог уже загружен, иначе каждый первый запрос выглядел бы пустым.
  if(typeof gtag==='function'&&fcReady){
    var found=pages.length+topModels.length+fcResults.length;
    gtag('event','search',{search_term:q,results:found,page_type:'search'});
    if(!found)gtag('event','search_no_results',{search_term:q,page_type:'search'});
  }

  // Trigger full catalog load on first search
  if(!fcReady&&!fcLoading&&(activeFilter==='all'||activeFilter==='model')){
    loadFcData();
  }
}

// ── Подсказки при вводе ────────────────────────────────────────────────────
// Подсказываем словами самого каталога, а не выдуманным списком: если слова
// нет в названиях моделей, подсказка приведёт в пустую выдачу. Пока чанки не
// загружены, словаря нет и подсказок мы не показываем - лучше молчать, чем
// подсказывать наугад.
var acEl=document.getElementById('ac-list');
var acItems=[], acPos=-1;

function acHide(){
  if(!acEl)return;
  acEl.hidden=true; acEl.innerHTML=''; acItems=[]; acPos=-1;
}
function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function acShow(q){
  if(!acEl)return;
  var last=toTokens(q).pop();
  if(!VOCAB.length||!last||last.length<2||/\s$/.test(q)){acHide();return;}
  var prefix=normQ(q).slice(0,normQ(q).length-last.length);
  var out=[];
  for(var i=0;i<VOCAB.length&&out.length<8;i++){
    var w=VOCAB[i];
    if(w===last||w.indexOf(last)!==0)continue;
    out.push(w);
  }
  if(!out.length){acHide();return;}
  acItems=out.map(function(w){return (prefix+w).trim();});
  acEl.innerHTML=out.map(function(w,k){
    return '<button type="button" class="ac-item" role="option" data-k="'+k+'">'
      +'<span><span class="ac-hi">'+escHtml(last)+'</span>'+escHtml(w.slice(last.length))+'</span>'
      +'<span class="ac-n">'+(VOCAB_COUNT[w]||0)+'</span></button>';
  }).join('');
  acEl.hidden=false;
  acPos=-1;
}
function acPick(k){
  if(k<0||k>=acItems.length)return;
  var v=acItems[k];
  if(qEl)qEl.value=v;
  acHide();
  updateUrl(v); runSearch(v);
  if(qEl)qEl.focus();
}
if(acEl){
  acEl.addEventListener('click',function(e){
    var b=e.target.closest('.ac-item');
    if(b)acPick(parseInt(b.dataset.k,10));
  });
}
document.addEventListener('click',function(e){
  if(acEl&&!acEl.hidden&&!e.target.closest('.search-box'))acHide();
});

// ── DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  bindPopularSearches();
  showHint();

  if(qEl){
    qEl.addEventListener('input',function(){
      var q=this.value.trim();
      if(clearBtn)clearBtn.classList.toggle('show',!!q);
      acShow(q);
      clearTimeout(debT);
      debT=setTimeout(function(){updateUrl(q);runSearch(q);},300);
    });
    // Стрелками ходим по подсказкам, Enter выбирает, Escape закрывает.
    qEl.addEventListener('keydown',function(e){
      if(!acEl||acEl.hidden)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();
        var n=acItems.length;
        acPos=e.key==='ArrowDown'?(acPos+1)%n:(acPos<=0?n-1:acPos-1);
        var btns=acEl.querySelectorAll('.ac-item');
        for(var i=0;i<btns.length;i++)btns[i].classList.toggle('active',i===acPos);
      }else if(e.key==='Enter'){
        if(acPos>=0){e.preventDefault();acPick(acPos);}
        else acHide();
      }else if(e.key==='Escape'){acHide();}
    });
  }

  if(clearBtn){
    clearBtn.addEventListener('click',function(){
      if(qEl)qEl.value='';
      clearBtn.classList.remove('show');
      acHide();
      lastQ='';updateUrl('');showHint();
      if(qEl)qEl.focus();
    });
  }

  document.querySelectorAll('.tab[data-filter]').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tab[data-filter]').forEach(function(b){b.classList.remove('active');});
      this.classList.add('active');
      activeFilter=this.dataset.filter;
      if(lastQ.length>1)runSearch(lastQ);
    });
  });

  if(showMoreBtn){
    showMoreBtn.addEventListener('click',function(){appendModelCards();});
  }

  var urlQ=new URLSearchParams(location.search).get('q');
  if(urlQ){
    if(qEl)qEl.value=urlQ;
    if(clearBtn)clearBtn.classList.add('show');
    runSearch(urlQ);
  }
});

})();
