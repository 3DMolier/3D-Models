/*
 * ПОИСК ПО КАРТИНКЕ в каталоге (17.11.2026, просьба основателя).
 *
 * Грузится только по нажатию кнопки с фотоаппаратом (см. конец full-catalog.js). Сервер ничего не
 * считает: снимок посетителя не покидает его браузер. Модель MobileCLIP-S0 (12 МБ, Apple, через
 * transformers.js) превращает снимок в вектор из 512 чисел; та же модель заранее посчитала векторы
 * для главных картинок всех моделей каталога (tools/image-search/build-index.mjs). Векторы сжаты
 * до D чисел (проекция на главные оси) и до одного байта на число - файл /data/img-search/index.bin.
 * Похожесть - скалярное произведение. Первые TOP моделей уходят в каталог через FC_API.setSimilar,
 * и сетка, страницы, фильтры категорий и цен работают как обычно.
 *
 * Формат index.bin (little-endian): Uint32 magic 'IMS1', N, D, DIM; Float32 P[DIM*D] (по строкам);
 * Int32 ids[N]; Int8 vec[N*D].
 */
(function(){
'use strict';
var TF='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
var MODEL='Xenova/mobileclip_s0';
var TOP=240;
var tf=null, proc=null, model=null, index=null, busy=false;

function el(id){return document.getElementById(id);}
function bar(){
  var b=el('imgs-bar');
  if(b)return b;
  var grid=el('model-grid');if(!grid)return null;
  b=document.createElement('div');b.id='imgs-bar';b.className='imgs-bar';b.setAttribute('role','status');b.setAttribute('aria-live','polite');
  grid.parentNode.insertBefore(b,grid);
  var st=document.createElement('style');
  st.textContent='.imgs-bar{display:flex;align-items:center;gap:14px;margin:0 0 18px;padding:10px 14px;border:1px solid rgba(127,127,127,.3);border-radius:12px;font-size:15px}.imgs-bar img{width:64px;height:64px;object-fit:cover;border-radius:8px;flex:none}.imgs-bar .imgs-t{flex:1;min-width:0}.imgs-bar .imgs-s{opacity:.7;font-size:13px;margin-top:2px}.imgs-bar button{border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit;font-size:14px}.imgs-bar button:hover{background:rgba(127,127,127,.12)}.sw.drag{outline:2px dashed currentColor;outline-offset:3px;border-radius:10px}';
  document.head.appendChild(st);
  return b;
}
function show(src,title,sub,done){
  var b=bar();if(!b)return;
  b.hidden=false;
  b.innerHTML=(src?'<img alt="Your image" src="'+src+'">':'')
    +'<div class="imgs-t"><div><strong>'+title+'</strong></div>'+(sub?'<div class="imgs-s">'+sub+'</div>':'')+'</div>'
    +(done?'<button type="button" id="imgs-clear">Clear</button>':'');
  var c=el('imgs-clear');
  if(c)c.addEventListener('click',function(){
    b.hidden=true;b.innerHTML='';
    if(window.FC_API)FC_API.setSimilar(null);
  });
}

function loadIndex(){
  if(index)return Promise.resolve(index);
  return fetch('/data/img-search/index.bin?v='+(window.IMGS_V||'1')).then(function(r){
    if(!r.ok)throw new Error('index '+r.status);return r.arrayBuffer();
  }).then(function(buf){
    var h=new Uint32Array(buf,0,4);
    if(h[0]!==0x31534d49)throw new Error('index format');
    var N=h[1],D=h[2],DIM=h[3],off=16;
    var P=new Float32Array(buf,off,DIM*D);off+=DIM*D*4;
    var ids=new Int32Array(buf,off,N);off+=N*4;
    var vec=new Int8Array(buf,off,N*D);
    index={N:N,D:D,DIM:DIM,P:P,ids:ids,vec:vec};
    return index;
  });
}
function loadModel(){
  if(model)return Promise.resolve();
  return import(TF).then(function(m){
    tf=m;
    tf.env.allowLocalModels=false;
    return Promise.all([
      tf.AutoProcessor.from_pretrained(MODEL),
      tf.CLIPVisionModelWithProjection.from_pretrained(MODEL,{dtype:'fp16',device:'wasm'})
    ]);
  }).then(function(r){proc=r[0];model=r[1];});
}
function embed(file){
  return tf.RawImage.fromBlob(file).then(function(img){return proc(img);}).then(function(inp){return model(inp);})
    .then(function(out){return out.image_embeds.data;});
}
function rank(v){
  var I=index,D=I.D,DIM=I.DIM,P=I.P,q=new Float32Array(D),s=0,k,j;
  for(k=0;k<DIM;k++)s+=v[k]*v[k];
  s=Math.sqrt(s)||1;
  for(k=0;k<DIM;k++){var x=v[k]/s;if(!x)continue;for(j=0;j<D;j++)q[j]+=x*P[k*D+j];}
  var N=I.N,vec=I.vec,sc=new Float32Array(N);
  for(var i=0,o=0;i<N;i++,o+=D){var t=0;for(j=0;j<D;j++)t+=q[j]*vec[o+j];sc[i]=t;}
  // Полная сортировка 38 тыс. чисел занимает ~10 мс - отдельный отбор лучших не нужен.
  var order=new Array(N);for(i=0;i<N;i++)order[i]=i;
  order.sort(function(a,b){return sc[b]-sc[a];});
  var res=[];for(i=0;i<Math.min(TOP,N);i++)res.push(I.ids[order[i]]);
  return res;
}

window.ImageSearch={
  search:function(file){
    if(busy)return;busy=true;
    var url=URL.createObjectURL(file);
    var first=!model;
    show(url,'Analyzing your image…',first?'Loading the visual search model (about 12 MB, once)':'',false);
    Promise.all([loadModel(),loadIndex()]).then(function(){
      show(url,'Analyzing your image…','',false);
      return embed(file);
    }).then(function(v){
      var ids=rank(v);
      show(url,'Models that look like your image','Most similar first. Category and price filters narrow the list.',true);
      if(window.FC_API)FC_API.setSimilar(ids);
      if(typeof gtag==='function')gtag('event','image_search_done',{page_type:'catalog'});
    }).catch(function(e){
      console.error('image search',e);
      show(url,'Could not analyze this image','Please try another picture (JPG, PNG or WebP).',true);
    }).then(function(){busy=false;});
  }
};
})();
