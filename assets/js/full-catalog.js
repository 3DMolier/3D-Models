(function(){
'use strict';

var FC={i:[],n:[],p:[],s:[],c:[]}, IMGS={}, fcReady=false;
var searchQ='', selPrice=null, selCert=null, sortMode='sales';
var filtered=[], page=0, PAGE_SIZE=60;

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

fetch('/3D-Models/data/fc.json').then(function(r){return r.json();}).then(function(d){
  FC=d; fcReady=true;
  var spinner=statusMsg?statusMsg.querySelector('.bar-spinner'):null;
  if(spinner)spinner.style.display='none';
  if(statusText)statusText.textContent='';
  if(sortSel)sortSel.disabled=false;
  if(qEl){qEl.disabled=false;qEl.placeholder='Search '+FC.n.length+' models…';}
  if(filterBar)filterBar.style.display='';
  fetch('/3D-Models/data/fc-img.json').then(function(r){return r.json();}).then(function(imgs){
    IMGS=imgs; renderGrid();
  }).catch(function(){renderGrid();});
  applyFilters();
  var urlQ=new URLSearchParams(location.search).get('q');
  if(urlQ&&qEl){qEl.value=urlQ;searchQ=urlQ.toLowerCase();applyFilters();}
}).catch(function(){
  if(statusText)statusText.textContent='Failed to load catalog. Please refresh.';
});

function applyFilters(){
  if(!fcReady)return;
  filtered=[];
  for(var i=0;i<FC.n.length;i++){
    if(searchQ&&FC.n[i].toLowerCase().indexOf(searchQ)===-1)continue;
    if(selPrice){
      var pr=FC.p[i];
      if(selPrice==='u5'&&pr>=5)continue;
      else if(selPrice==='u15'&&(pr<5||pr>=15))continue;
      else if(selPrice==='u30'&&(pr<15||pr>=30))continue;
      else if(selPrice==='u60'&&(pr<30||pr>=60))continue;
      else if(selPrice==='u120'&&(pr<60||pr>=120))continue;
      else if(selPrice==='u999'&&pr<120)continue;
    }
    if(selCert!==null&&FC.c[i]!==selCert)continue;
    filtered.push(i);
  }
  filtered.sort(function(a,b){
    if(sortMode==='sales')return(FC.s[b]||0)-(FC.s[a]||0);
    if(sortMode==='price_asc')return FC.p[a]-FC.p[b];
    if(sortMode==='price_desc')return FC.p[b]-FC.p[a];
    if(sortMode==='name')return FC.n[a]<FC.n[b]?-1:FC.n[a]>FC.n[b]?1:0;
    return 0;
  });
  page=0;
  renderGrid();
  updateStatus();
}

function renderGrid(){
  if(!grid||!fcReady)return;
  var toShow=filtered.slice(0,(page+1)*PAGE_SIZE);
  if(filtered.length===0){
    grid.innerHTML='';
    if(emptyEl)emptyEl.style.display='block';
    if(lmBtn)lmBtn.style.display='none';
    return;
  }
  if(emptyEl)emptyEl.style.display='none';
  var html='';
  for(var i=0;i<toShow.length;i++)html+=modelCard(toShow[i]);
  grid.innerHTML=html;
  if(lmBtn){
    if(toShow.length<filtered.length){
      lmBtn.style.display='block';
      lmBtn.textContent='Load more ('+(filtered.length-toShow.length)+' remaining)';
    }else{lmBtn.style.display='none';}
  }
}

function modelCard(idx){
  var id=FC.i[idx],name=FC.n[idx],price=FC.p[idx],cert=FC.c[idx],sales=FC.s[idx];
  var imgHtml=IMGS[id]
    ?'<img src="'+IMGS[id]+'" alt="'+name.replace(/"/g,'&quot;')+'" loading="lazy">'
    :'<div class="mc-ph">&#128246;</div>';
  var certBadge=cert===2?'<span class="mc-cert cert-cm">CheckMate</span>'
    :cert===1?'<span class="mc-cert cert-sc">StemCell</span>':'';
  var salesHtml=sales?'<span class="mc-sold">'+sales+' sold</span>':'';
  return '<a href="https://www.turbosquid.com/FullPreview/'+id+'?referral=3d_molier-studio" target="_blank" rel="noopener" class="mc">'
    +'<div class="mc-img">'+imgHtml+'<div class="mc-ov"></div>'+certBadge+'<div class="mc-qv">Quick View</div></div>'
    +'<div class="mc-body"><div class="mc-name">'+name+'</div>'
    +'<div class="mc-foot"><span class="mc-price">$'+price+'</span>'+salesHtml+'</div>'
    +'</div></a>';
}

function updateStatus(){
  if(resultCount)resultCount.innerHTML='<strong>'+filtered.length+'</strong> of '+FC.n.length+' models';
  if(statusText)statusText.textContent='';
}

if(qEl){
  var debT=null;
  qEl.addEventListener('input',function(){
    clearTimeout(debT);var val=this.value.trim();
    debT=setTimeout(function(){searchQ=val.toLowerCase();applyFilters();},220);
  });
}
if(sortSel)sortSel.addEventListener('change',function(){sortMode=this.value;applyFilters();});
if(clearAll)clearAll.addEventListener('click',function(){
  searchQ='';selPrice=null;selCert=null;
  if(qEl)qEl.value='';
  document.querySelectorAll('.ftag').forEach(function(b){b.classList.remove('active');});
  clearAll.classList.remove('show');
  applyFilters();
});
if(lmBtn)lmBtn.addEventListener('click',function(){page++;renderGrid();});

document.querySelectorAll('.ftag[data-price]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var pr=this.dataset.price;
    if(selPrice===pr){selPrice=null;this.classList.remove('active');}
    else{document.querySelectorAll('.ftag[data-price]').forEach(function(b){b.classList.remove('active');});selPrice=pr;this.classList.add('active');}
    if(clearAll)clearAll.classList.toggle('show',selPrice!==null||selCert!==null||!!searchQ);
    applyFilters();
  });
});
document.querySelectorAll('.ftag[data-cert]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var cert=parseInt(this.dataset.cert);
    if(selCert===cert){selCert=null;this.classList.remove('active');}
    else{document.querySelectorAll('.ftag[data-cert]').forEach(function(b){b.classList.remove('active');});selCert=cert;this.classList.add('active');}
    if(clearAll)clearAll.classList.toggle('show',selPrice!==null||selCert!==null||!!searchQ);
    applyFilters();
  });
});
document.querySelectorAll('.ps-tag').forEach(function(btn){
  btn.addEventListener('click',function(){
    var q=this.dataset.q;
    if(qEl)qEl.value=q;
    searchQ=q.toLowerCase();
    applyFilters();
  });
});

})();
