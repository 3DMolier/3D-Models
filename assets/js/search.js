(function(){
'use strict';

var PAGES=[{"type":"category","title":"Vehicles","page":"/3D-Models/categories/vehicles/","icon":"🚗","count":292},{"type":"category","title":"Aircraft","page":"/3D-Models/categories/aircraft/","icon":"✈️","count":173},{"type":"category","title":"Military Vehicles","page":"/3D-Models/categories/military-vehicles/","icon":"🪖","count":79},{"type":"category","title":"Ships","page":"/3D-Models/categories/ships/","icon":"⚓","count":64},{"type":"category","title":"Medical","page":"/3D-Models/categories/medical-3d-models/","icon":"🧬","count":101},{"type":"category","title":"Industrial Equipment","page":"/3D-Models/categories/industrial-equipment/","icon":"⚙️","count":34},{"type":"category","title":"Architecture Landmarks","page":"/3D-Models/categories/architecture-landmarks/","icon":"🏛️","count":57},{"type":"category","title":"Characters & People","page":"/3D-Models/categories/characters-people/","icon":"👤","count":4},{"type":"category","title":"Animals & Creatures","page":"/3D-Models/categories/animals-creatures/","icon":"🐾","count":13},{"type":"category","title":"Nature & Plants","page":"/3D-Models/categories/nature-plants/","icon":"🌿","count":18},{"type":"category","title":"Furniture & Interior","page":"/3D-Models/categories/furniture-interior/","icon":"🪑","count":8},{"type":"category","title":"Electronics & Gadgets","page":"/3D-Models/categories/electronics-gadgets/","icon":"💻","count":10},{"type":"category","title":"Clothing & Accessories","page":"/3D-Models/categories/clothing-accessories/","icon":"👗","count":12},{"type":"category","title":"Food & Beverages","page":"/3D-Models/categories/food-beverages/","icon":"🍕","count":4},{"type":"category","title":"Other","page":"/3D-Models/categories/other/","icon":"📦","count":131},{"type":"collection","title":"Best Vehicle 3D Models","page":"/3D-Models/collections/best-vehicle-3d-models/","icon":"🚗"},{"type":"collection","title":"Best Military Vehicle 3D Models","page":"/3D-Models/collections/best-military-vehicle-3d-models/","icon":"🪖"},{"type":"collection","title":"Best Aircraft 3D Models","page":"/3D-Models/collections/best-aircraft-3d-models/","icon":"✈️"},{"type":"collection","title":"Best Ship 3D Models","page":"/3D-Models/collections/best-ship-3d-models/","icon":"⚓"},{"type":"collection","title":"Best Medical 3D Models","page":"/3D-Models/collections/best-medical-3d-models/","icon":"🧬"},{"type":"collection","title":"Best Architecture 3D Models","page":"/3D-Models/collections/best-architecture-landmark-3d-models/","icon":"🏛️"},{"type":"collection","title":"CheckMate Certified 3D Models","page":"/3D-Models/collections/checkmate-certified-3d-models/","icon":"✅"},{"type":"collection","title":"StemCell Certified 3D Models","page":"/3D-Models/collections/stemcell-certified-3d-models/","icon":"🔬"},{"type":"industry","title":"Aerospace","icon":"✈️","page":"/3D-Models/industries/aerospace/"},{"type":"industry","title":"Military & Defense","icon":"🪖","page":"/3D-Models/industries/military-defense/"},{"type":"industry","title":"Medical","icon":"🏥","page":"/3D-Models/industries/medical/"},{"type":"industry","title":"Game Development","icon":"🎮","page":"/3D-Models/industries/game-development/"},{"type":"industry","title":"Film Production","icon":"🎬","page":"/3D-Models/industries/film-video-production/"},{"type":"industry","title":"Architecture","icon":"🏛️","page":"/3D-Models/industries/architecture/"},{"type":"industry","title":"Virtual Reality","icon":"🥽","page":"/3D-Models/industries/virtual-reality/"},{"type":"industry","title":"Advertising","icon":"📢","page":"/3D-Models/industries/advertising/"},{"type":"industry","title":"Software Development","icon":"💻","page":"/3D-Models/industries/software-development/"},{"type":"industry","title":"Event Management","icon":"🎪","page":"/3D-Models/industries/event-management/"},{"type":"industry","title":"Hardware","icon":"⚙️","page":"/3D-Models/industries/hardware/"},{"type":"industry","title":"3D Printing","icon":"🖨️","page":"/3D-Models/industries/3d-printing/"}];

var PS=['aircraft','military vehicle','uav drone','ship','human anatomy','industrial engine','Tesla','container','helicopter','truck'];

var FC={i:[],n:[],p:[],s:[],c:[]}, IMGS={}, fcReady=false;
var lastQ='', debT=null, activeFilter='all';

var qEl=document.getElementById('q');
var clearBtn=document.getElementById('clear-q');
var resultsEl=document.getElementById('results');
var hintState=document.getElementById('hint-state');
var emptyState=document.getElementById('empty-state');
var tsLink=document.getElementById('ts-search-link');

// Load fc.json
fetch('/3D-Models/data/fc.json').then(function(r){return r.json();}).then(function(d){
  FC=d; fcReady=true;
  fetch('/3D-Models/data/fc-img.json').then(function(r){return r.json();}).then(function(imgs){
    IMGS=imgs; if(lastQ.length>1)runSearch(lastQ);
  }).catch(function(){if(lastQ.length>1)runSearch(lastQ);});
  if(lastQ.length>1)runSearch(lastQ);
}).catch(function(){});

// Build popular searches in hero
var hero=document.querySelector('.hero');
if(hero&&!hero.querySelector('.ps-wrap')){
  var psWrap=document.createElement('div');
  psWrap.className='ps-wrap';
  psWrap.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;justify-content:center';
  var psLbl=document.createElement('span');
  psLbl.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af';
  psLbl.textContent='Popular:';
  psWrap.appendChild(psLbl);
  PS.forEach(function(q){
    var btn=document.createElement('button');
    btn.textContent=q;
    btn.className='tab';
    btn.style.cssText='border-radius:16px;padding:4px 12px;font-size:12px;';
    btn.addEventListener('click',function(){
      if(qEl)qEl.value=q;
      if(clearBtn)clearBtn.classList.add('show');
      runSearch(q);
    });
    psWrap.appendChild(btn);
  });
  hero.appendChild(psWrap);
}

// Build hint categories
var hintCats=document.getElementById('hint-cats');
if(hintCats){
  var cats=PAGES.filter(function(p){return p.type==='category';});
  hintCats.innerHTML=cats.map(function(c){
    return '<a href="'+c.page+'" class="hint-cat"><span class="icon">'+c.icon+'</span>'+c.title+'</a>';
  }).join('');
}

function runSearch(q){
  lastQ=q;
  if(!q||q.length<2){showHint();return;}
  var ql=q.toLowerCase();
  var pageResults=PAGES.filter(function(x){
    if(activeFilter!=='all'&&x.type!==activeFilter)return false;
    return x.title.toLowerCase().indexOf(ql)>-1;
  });
  var modelResults=[];
  if(fcReady&&(activeFilter==='all'||activeFilter==='model')){
    for(var i=0;i<FC.n.length;i++){
      if(FC.n[i].toLowerCase().indexOf(ql)>-1){modelResults.push(i);if(modelResults.length>=60)break;}
    }
  }
  render(pageResults,modelResults,q);
}

function showHint(){
  if(hintState)hintState.style.display='';
  if(emptyState)emptyState.style.display='none';
  if(resultsEl)resultsEl.innerHTML='';
}

function render(pages,models,q){
  if(hintState)hintState.style.display='none';
  if(pages.length===0&&models.length===0){
    if(emptyState)emptyState.style.display='';
    if(tsLink)tsLink.href='https://www.turbosquid.com/Search/3D-Models?q='+encodeURIComponent(q)+'&referral=3d_molier-studio';
    if(resultsEl)resultsEl.innerHTML='';
    return;
  }
  if(emptyState)emptyState.style.display='none';
  var html='';
  if(pages.length>0){
    html+='<div class="result-section"><div class="section-header"><span class="section-title">Pages</span><span class="section-count">'+pages.length+'</span></div>';
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
    html+='<div class="result-section"><div class="section-header"><span class="section-title">Models</span>';
    html+='<span class="section-count">'+models.length+(models.length>=60?'+':'')+'</span>';
    html+='&nbsp;<a href="/3D-Models/full-catalog/?q='+encodeURIComponent(q)+'" style="color:#1659c9;text-decoration:none;font-size:11px;font-weight:600">see all &rarr;</a></div>';
    html+='<div class="model-grid">';
    models.forEach(function(idx){html+=modelCard(idx);});
    html+='</div>';
    html+='<div class="ts-card"><div class="ts-card-text"><h4>Search all 86,000+ models on TurboSquid</h4><p>Browse the complete catalog with advanced filters</p></div>';
    html+='<a href="https://www.turbosquid.com/Search/3D-Models?q='+encodeURIComponent(q)+'&referral=3d_molier-studio" target="_blank" rel="noopener">Search TurboSquid &nearr;</a></div>';
    html+='</div>';
  }
  if(resultsEl)resultsEl.innerHTML=html;
}

function modelCard(idx){
  var id=FC.i[idx],name=FC.n[idx],price=FC.p[idx],cert=FC.c[idx];
  var imgHtml=IMGS[id]
    ?'<img src="'+IMGS[id]+'" alt="'+name.replace(/"/g,'&quot;')+'" loading="lazy">'
    :'<div class="fallback" style="display:flex">&#128246;</div>';
  var certBadge=cert===2?'<span class="mc-cert cm-b">CheckMate</span>'
    :cert===1?'<span class="mc-cert sc-b">StemCell</span>':'';
  return '<a href="https://www.turbosquid.com/FullPreview/'+id+'?referral=3d_molier-studio" target="_blank" rel="noopener" class="model-card">'
    +'<div class="mc-img">'+imgHtml+'<div class="mc-overlay"></div>'+certBadge+'</div>'
    +'<div class="mc-body"><div class="mc-name">'+name+'</div>'
    +'<div class="mc-price">$'+price+'</div></div></a>';
}

document.addEventListener('DOMContentLoaded',function(){
  showHint();
  if(qEl){
    qEl.addEventListener('input',function(){
      var q=this.value.trim();
      if(clearBtn)clearBtn.classList.toggle('show',!!q);
      clearTimeout(debT);
      debT=setTimeout(function(){runSearch(q);},220);
    });
  }
  if(clearBtn){
    clearBtn.addEventListener('click',function(){
      if(qEl)qEl.value='';
      clearBtn.classList.remove('show');
      lastQ='';showHint();if(qEl)qEl.focus();
    });
  }
  document.querySelectorAll('.tab[data-filter]').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tab[data-filter]').forEach(function(b){b.classList.remove('active');});
      this.classList.add('active');activeFilter=this.dataset.filter;
      if(lastQ.length>1)runSearch(lastQ);
    });
  });
  var urlQ=new URLSearchParams(location.search).get('q');
  if(urlQ){
    if(qEl)qEl.value=urlQ;
    if(clearBtn)clearBtn.classList.add('show');
    runSearch(urlQ);
  }
});

})();
