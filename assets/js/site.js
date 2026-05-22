(function(){
var p=location.pathname,d=document;
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
})();
