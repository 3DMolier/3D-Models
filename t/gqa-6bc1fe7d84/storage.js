/* Адаптер хранилища для игры на 3dmolierstudio.com.
   Общие данные хранит Google Apps Script (backend/Code.gs) на Google Диске владельца;
   адрес веб-приложения задаётся в index.html как window.GQA_API.
   Если адрес не задан или хранилище недоступно - демо-режим: данные только в этом браузере.
   Интерфейс тот же, что у исходного storage.js (window.claude.use: db, user, assets). */
(function(){
var API=window.GQA_API||"",POLL=10000;
var LS=window.localStorage,KEY="gqa_db_v1",mode="local",cache={reports:{},config:{}},subs=[],last="";
function ls(k,v){try{if(v===undefined)return LS.getItem(k);LS.setItem(k,v)}catch(e){}return null}
function rid(){return Math.random().toString(36).slice(2,12)+Date.now().toString(36).slice(-4)}
var m=/[?&]admin=([^&#]*)/.exec(location.search);if(m){ls("gqa_key",decodeURIComponent(m[1]));try{history.replaceState(null,"",location.pathname)}catch(e){}}
var adminKey=ls("gqa_key")||"",uid=ls("gqa_uid")||(function(){var x=rid();ls("gqa_uid",x);return x})(),owner=false;
function clone(o){return JSON.parse(JSON.stringify(o))}
function mk(coll,id){return{id:id,exists:true,data:function(){return clone(cache[coll][id])}}}
function none(id){return{id:id,exists:false,data:function(){return undefined}}}
function notify(){subs.forEach(function(s){
 if(s.doc){var v=cache[s.coll][s.id],j=JSON.stringify(v||null);if(s.prev!==j){s.prev=j;s.cb(v?mk(s.coll,s.id):none(s.id))}}
 else{var cur=cache[s.coll],ch=[],ids=Object.keys(cur);
  ids.forEach(function(id){var j=JSON.stringify(cur[id]);if(s.prev===null||!(id in s.prev))ch.push({type:"added",doc:mk(s.coll,id)});else if(s.prev[id]!==j)ch.push({type:"modified",doc:mk(s.coll,id)})});
  if(s.prev)Object.keys(s.prev).forEach(function(id){if(!(id in cur))ch.push({type:"removed",doc:none(id)})});
  var np={};ids.forEach(function(id){np[id]=JSON.stringify(cur[id])});
  if(s.prev===null||ch.length){s.prev=np;s.cb({docs:ids.map(function(id){return mk(s.coll,id)}),docChanges:function(){return ch}})}}})}
function setCache(d){last=JSON.stringify(d);cache={reports:d.reports||{},config:d.config||{}};notify()}
function fail(msg,code){var e=new Error(msg);e.code=code||"error";return e}
// POST текстом: «простой» запрос, без предварительного OPTIONS - так Apps Script отвечает браузеру
function call(body){
 return fetch(API,{method:"POST",headers:{"content-type":"text/plain;charset=utf-8"},body:JSON.stringify(body)})
  .then(function(r){if(!r.ok)throw fail("хранилище не ответило ("+r.status+")");return r.json()})
  .then(function(j){if(j&&j.error){throw fail(j.status==403?"нет прав (нужен ключ администратора)":"ошибка хранилища: "+j.error,j.status==403?"permission_denied":"error")}return j})}
function pull(){return fetch(API,{cache:"no-store"}).then(function(r){var t=r.headers.get("content-type")||"";if(!r.ok||t.indexOf("json")<0)throw 0;return r.json()}).then(function(d){if(d&&d.error)throw 0;return d})}
function put(coll,id,data){
 if(mode=="server")return call({a:data?"put":"del",coll:coll,id:id,data:data||undefined,k:adminKey}).then(function(j){if(j.db)setCache(j.db);else{if(data)cache[coll][id]=data;else delete cache[coll][id];notify()}});
 if(data)cache[coll][id]=data;else delete cache[coll][id];ls(KEY,JSON.stringify(cache));notify();return Promise.resolve()}
var db={collection:function(c){return{
 add:function(d){var id=rid();return put(c,id,clone(d)).then(function(){return{id:id}})},
 onSnapshot:function(cb){var s={doc:false,coll:c,cb:cb,prev:null};subs.push(s);setTimeout(notify,0);return function(){subs.splice(subs.indexOf(s),1)}}}},
 doc:function(p){var a=p.split("/"),c=a[0],id=a[1];return{
 set:function(d){return put(c,id,clone(d))},
 update:function(d){var cur=cache[c][id];if(!cur)return Promise.reject(fail("документ не найден","not_found"));return put(c,id,Object.assign({},cur,clone(d)))},
 get:function(){return Promise.resolve(cache[c][id]?mk(c,id):none(id))},
 onSnapshot:function(cb){var s={doc:true,coll:c,id:id,cb:cb,prev:undefined};subs.push(s);setTimeout(notify,0);return function(){subs.splice(subs.indexOf(s),1)}}}}};
function demo(){
 mode="local";try{var d=JSON.parse(ls(KEY)||"{}");cache={reports:d.reports||{},config:d.config||{}};notify()}catch(e){}
 owner=!!adminKey;window.addEventListener("storage",function(e){if(e.key==KEY){try{var d=JSON.parse(e.newValue||"{}");cache={reports:d.reports||{},config:d.config||{}};notify()}catch(x){}}});
 var b=document.getElementById("banner");if(b)b.textContent="Демо-режим: общее хранилище недоступно, данные хранятся только в этом браузере."}
var ready=(API?pull():Promise.reject(0)).then(function(d){
 mode="server";setCache(d);
 // свежие данные раз в 10 с, пока вкладка открыта; в фоне не опрашиваем
 setInterval(function(){if(document.hidden)return;pull().then(function(d){if(JSON.stringify(d)!==last)setCache(d)}).catch(function(){})},POLL);
 document.addEventListener("visibilitychange",function(){if(!document.hidden)pull().then(function(d){if(JSON.stringify(d)!==last)setCache(d)}).catch(function(){})});
 if(!adminKey)return;
 return call({a:"whoami",k:adminKey}).then(function(j){owner=!!j.owner}).catch(function(){})
}).catch(demo);
function b64(blob){return new Promise(function(ok,no){var f=new FileReader();f.onload=function(){ok(String(f.result).split(",")[1]||"")};f.onerror=function(){no(fail("не удалось прочитать файл"))};f.readAsDataURL(blob)})}
window.claude={use:function(n){return ready.then(function(){
 if(n=="db")return db;
 if(n=="user")return{isOwner:function(){return owner},id:function(){return Promise.resolve(uid)}};
 if(n=="assets")return{upload:function(blob){
  if(mode=="server")return b64(blob).then(function(s){return call({a:"upload",type:blob.type||"image/jpeg",b64:s})}).then(function(j){return{id:j.id}});
  return new Promise(function(ok,no){var f=new FileReader();f.onload=function(){ok({id:f.result})};f.onerror=function(){no(fail("не удалось прочитать файл"))};f.readAsDataURL(blob)})}};
 return null})}};
})();
