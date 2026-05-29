(function(){
'use strict';

var CATALOG_URL='/3D-Models/data/catalog.json';
var PAGE_SIZE=24;

var PAGES=[{"type":"category","title":"Vehicles","page":"/3D-Models/categories/vehicles/","icon":"🚗","count":292},{"type":"category","title":"Aircraft","page":"/3D-Models/categories/aircraft/","icon":"✈️","count":173},{"type":"category","title":"Military Vehicles","page":"/3D-Models/categories/military-vehicles/","icon":"🪖","count":79},{"type":"category","title":"Ships","page":"/3D-Models/categories/ships/","icon":"⚓","count":64},{"type":"category","title":"Medical","page":"/3D-Models/categories/medical-3d-models/","icon":"🧬","count":101},{"type":"category","title":"Industrial Equipment","page":"/3D-Models/categories/industrial-equipment/","icon":"⚙️","count":34},{"type":"category","title":"Architecture Landmarks","page":"/3D-Models/categories/architecture-landmarks/","icon":"🏛️","count":57},{"type":"category","title":"Characters & People","page":"/3D-Models/categories/characters-people/","icon":"👤","count":4},{"type":"category","title":"Animals & Creatures","page":"/3D-Models/categories/animals-creatures/","icon":"🐾","count":13},{"type":"category","title":"Nature & Plants","page":"/3D-Models/categories/nature-plants/","icon":"🌿","count":18},{"type":"category","title":"Furniture & Interior","page":"/3D-Models/categories/furniture-interior/","icon":"🪑","count":8},{"type":"category","title":"Electronics & Gadgets","page":"/3D-Models/categories/electronics-gadgets/","icon":"💻","count":10},{"type":"category","title":"Clothing & Accessories","page":"/3D-Models/categories/clothing-accessories/","icon":"👗","count":12},{"type":"category","title":"Food & Beverages","page":"/3D-Models/categories/food-beverages/","icon":"🍕","count":4},{"type":"category","title":"Other","page":"/3D-Models/categories/other/","icon":"📦","count":131},{"type":"collection","title":"Best Vehicle 3D Models","page":"/3D-Models/collections/best-vehicle-3d-models/","icon":"🚗"},{"type":"collection","title":"Best Military Vehicle 3D Models","page":"/3D-Models/collections/best-military-vehicle-3d-models/","icon":"🪖"},{"type":"collection","title":"Best Aircraft 3D Models","page":"/3D-Models/collections/best-aircraft-3d-models/","icon":"✈️"},{"type":"collection","title":"Best Ship 3D Models","page":"/3D-Models/collections/best-ship-3d-models/","icon":"⚓"},{"type":"collection","title":"Best Medical 3D Models","page":"/3D-Models/collections/best-medical-3d-models/","icon":"🧬"},{"type":"collection","title":"Best Architecture 3D Models","page":"/3D-Models/collections/best-architecture-landmark-3d-models/","icon":"🏛️"},{"type":"collection","title":"CheckMate Certified 3D Models","page":"/3D-Models/collections/checkmate-certified-3d-models/","icon":"✅"},{"type":"collection","title":"StemCell Certified 3D Models","page":"/3D-Models/collections/stemcell-certified-3d-models/","icon":"🔬"},{"type":"industry","title":"Aerospace","icon":"✈️","page":"/3D-Models/industries/aerospace/"},{"type":"industry","title":"Military & Defense","icon":"🪖","page":"/3D-Models/industries/military-defense/"},{"type":"industry","title":"Medical","icon":"🏥","page":"/3D-Models/industries/medical/"},{"type":"industry","title":"Game Development","icon":"🎮","page":"/3D-Models/industries/game-development/"},{"type":"industry","title":"Film Production","icon":"🎬","page":"/3D-Models/industries/film-video-production/"},{"type":"industry","title":"Architecture","icon":"🏛️","page":"/3D-Models/industries/architecture/"},{"type":"industry","title":"Virtual Reality","icon":"🥽","page":"/3D-Models/industries/virtual-reality/"},{"type":"industry","title":"Advertising","icon":"📢","page":"/3D-Models/industries/advertising/"},{"type":"industry","title":"Software Development","icon":"💻","page":"/3D-Models/industries/software-development/"},{"type":"industry","title":"Event Management","icon":"🎪","page":"/3D-Models/industries/event-management/"},{"type":"industry","title":"Hardware","icon":"⚙️","page":"/3D-Models/industries/hardware/"},{"type":"industry","title":"3D Printing","icon":"🖨️","page":"/3D-Models/industries/3d-printing/"}];

var MODELS=[], catalogReady=false;
var lastQ='', debT=null, activeFilter='all';
var currentModelResults=[], renderedCount=0;

var qEl=document.getElementById('q');
var clearBtn=document.getElementById('clear-q');
var resultsEl=document.getElementById('results');
var hintState=document.getElementById('hint-state');
var emptyState=document.getElementById('empty-state');
var tsLink=document.getElementById('ts-search-link');
var statusEl=document.getElementById('search-status');
var countEl=document.getElementById('result-count');
var showMoreBtn=document.getElementById('show-more');

// ── Status (ТЗ 5) ──────────────────────────────────────────────────────────
function setStatus(msg){
  if(!statusEl)return;
  statusEl.textContent=msg||'';
  statusEl.hidden=!msg;
}

// ── URL sync (ТЗ 4) ───────────────────────────────────────────────────────
function updateUrl(q){
  var url=new URL(window.location.href);
  if(q)url.searchParams.set('q',q);
  else url.searchParams.delete('q');
  window.history.replaceState({},'',url.toString());
}

// ── Error fallback (ТЗ 2) ─────────────────────────────────────────────────
function showDataError(){
  if(hintState)hintState.style.display='none';
  if(showMoreBtn)showMoreBtn.hidden=true;
  if(countEl)countEl.textContent='';
  if(!resultsEl)return;
  resultsEl.innerHTML='<div class="search-warning" role="status">'
    +'<h2>Search data is temporarily unavailable</h2>'
    +'<p>Model search data could not be loaded right now. You can still browse the Full 86K Catalog or search the 3D Molier TurboSquid store.</p>'
    +'<div class="search-warning-actions">'
    +'<a class="btn-primary" href="/3D-Models/full-catalog/">Open Full 86K Catalog</a>'
    +'<a class="btn-ghost" href="https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio" target="_blank" rel="noopener">Search on TurboSquid ↗</a>'
    +'</div></div>';
}

// ── Load catalog.json ──────────────────────────────────────────────────────
setStatus('Loading search index…');
fetch(CATALOG_URL)
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(d){
    MODELS=Array.isArray(d)?d:[];
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

// ── Hint categories ────────────────────────────────────────────────────────
var hintCats=document.getElementById('hint-cats');
if(hintCats){
  var cats=PAGES.filter(function(p){return p.type==='category';});
  hintCats.innerHTML=cats.map(function(c){
    return '<a href="'+c.page+'" class="hint-cat"><span class="icon">'+c.icon+'</span>'+c.title+'</a>';
  }).join('');
}

// ── Popular Searches — bound in DOMContentLoaded (ТЗ 4) ───────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
function proxyImg(url){
  if(!url)return '';
  if(url.indexOf('static.turbosquid.com')>-1)
    return 'https://images.weserv.nl/?url='+encodeURIComponent(url)+'&w=600&q=85&output=webp';
  return url;
}

function certBadge(cert){
  if(!cert||cert==='no certification')return '';
  if(cert.indexOf('CheckMate')>-1)return '<span class="s-cert cm-b">CheckMate</span>';
  if(cert.indexOf('StemCell')>-1)return '<span class="s-cert sc-b">StemCell</span>';
  return '';
}

function getTsId(slug){
  var m=String(slug||'').match(/-(\d+)$/);
  return m?m[1]:'';
}

// ── Model card HTML (ТЗ 1 — article, no nested <a>) ──────────────────────
function modelCard(m){
  var slug=m.s||'';
  var localUrl='/3D-Models/models/'+slug+'/';
  var id=getTsId(slug);
  var tsUrl=id
    ?'https://www.turbosquid.com/FullPreview/'+id+'?referral=3d_molier-studio'
    :'https://www.turbosquid.com/Search/Artists/3d_molier-International?referral=3d_molier-studio';
  var src=proxyImg(m.img);
  var nameEsc=String(m.n||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var nameHtml=String(m.n||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  var imgTag=src
    ?'<img src="'+src+'" alt="'+nameEsc+' 3D model" width="800" height="450" loading="lazy" decoding="async">'
    :'<div class="s-mc-ph">📶</div>';
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

// ── Pagination helpers (ТЗ 3) ─────────────────────────────────────────────
function updateCount(){
  if(!countEl)return;
  var total=currentModelResults.length;
  if(!total){countEl.textContent='';return;}
  countEl.textContent='Showing '+Math.min(renderedCount,total)+' of '+total+' model'+(total===1?'':' results');
}

function updateShowMore(){
  if(!showMoreBtn)return;
  showMoreBtn.hidden=renderedCount>=currentModelResults.length;
}

function appendModelCards(){
  var modelSection=document.getElementById('model-results');
  if(!modelSection)return;
  var next=currentModelResults.slice(renderedCount,renderedCount+PAGE_SIZE);
  if(next.length){
    modelSection.insertAdjacentHTML('beforeend',next.map(modelCard).join(''));
    renderedCount+=next.length;
  }
  updateCount();
  updateShowMore();
}

// ── Hint / empty ───────────────────────────────────────────────────────────
function showHint(){
  if(hintState)hintState.style.display='';
  if(emptyState)emptyState.style.display='none';
  if(countEl)countEl.textContent='';
  if(showMoreBtn)showMoreBtn.hidden=true;
  if(resultsEl)resultsEl.innerHTML='';
  currentModelResults=[];
  renderedCount=0;
}

// ── Render ─────────────────────────────────────────────────────────────────
function render(pages,models,q){
  if(hintState)hintState.style.display='none';
  if(pages.length===0&&models.length===0){
    if(emptyState)emptyState.style.display='';
    if(tsLink)tsLink.href='https://www.turbosquid.com/Search/3D-Models?q='+encodeURIComponent(q)+'&referral=3d_molier-studio';
    if(countEl)countEl.textContent='';
    if(showMoreBtn)showMoreBtn.hidden=true;
    if(resultsEl)resultsEl.innerHTML='';
    return;
  }
  if(emptyState)emptyState.style.display='none';
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
  if(models.length>0){
    html+='<div class="result-section">';
    html+='<div class="section-header">';
    html+='<span class="section-title">Models</span>';
    html+='<a href="/3D-Models/full-catalog/?q='+encodeURIComponent(q)+'" style="color:#1659c9;text-decoration:none;font-size:11px;font-weight:600">see all in 86K catalog →</a>';
    html+='</div>';
    html+='<div class="s-mc-grid" id="model-results"></div>';
    html+='<div class="ts-card" style="margin-top:16px">';
    html+='<div class="ts-card-text"><h4>Search all 86,000+ models on TurboSquid</h4><p>Browse the complete catalog with advanced filters</p></div>';
    html+='<a href="https://www.turbosquid.com/Search/3D-Models?q='+encodeURIComponent(q)+'&referral=3d_molier-studio" target="_blank" rel="noopener">Search TurboSquid ↗</a>';
    html+='</div></div>';
  }
  if(resultsEl)resultsEl.innerHTML=html;
  if(models.length>0){
    renderedCount=0;
    appendModelCards();
  }
}

// ── Search ─────────────────────────────────────────────────────────────────
function runSearch(q){
  lastQ=q;
  if(!q||q.length<2){showHint();return;}
  var ql=q.toLowerCase();
  var pages=PAGES.filter(function(x){
    if(activeFilter!=='all'&&x.type!==activeFilter)return false;
    return x.title.toLowerCase().indexOf(ql)>-1;
  });
  var models=[];
  if(catalogReady&&(activeFilter==='all'||activeFilter==='model')){
    for(var i=0;i<MODELS.length;i++){
      var m=MODELS[i];
      if((m.n&&m.n.toLowerCase().indexOf(ql)>-1)
        ||(m.c&&m.c.toLowerCase().indexOf(ql)>-1)
        ||(m.s&&m.s.toLowerCase().indexOf(ql)>-1)){
        models.push(m);
      }
    }
  }
  currentModelResults=models;
  renderedCount=0;
  render(pages,models,q);
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  bindPopularSearches();
  showHint();

  if(qEl){
    qEl.addEventListener('input',function(){
      var q=this.value.trim();
      if(clearBtn)clearBtn.classList.toggle('show',!!q);
      clearTimeout(debT);
      debT=setTimeout(function(){updateUrl(q);runSearch(q);},250);
    });
  }

  if(clearBtn){
    clearBtn.addEventListener('click',function(){
      if(qEl)qEl.value='';
      clearBtn.classList.remove('show');
      lastQ='';
      updateUrl('');
      showHint();
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
