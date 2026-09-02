/*
 * model-page.js - галерея и лайтбокс на карточке модели.
 *
 * Раньше этот код лежал ВНУТРИ каждой из 54 077 карточек по 3,2 КБ. Один и тот
 * же скрипт, скопированный 54 тысячи раз, - это 190 МБ рабочего дерева и 3 КБ,
 * которые заново ехали к посетителю на каждой странице. Здесь он один и
 * кешируется браузером после первой карточки.
 *
 * Подключается с defer в конце body - как и стоял встроенный вариант.
 */
(function(){
  var strip=document.querySelector('.mp-gal-strip');
  var prev=document.querySelector('.mp-gal-prev'), next=document.querySelector('.mp-gal-next');
  if(!strip||!prev||!next) return;

  // Стрелки листают ленту на видимую ширину, как на TurboSquid.
  function page(dir){ strip.scrollLeft += dir * Math.max(120, strip.clientWidth - 40); }
  prev.addEventListener('click',function(){ page(-1); });
  next.addEventListener('click',function(){ page(1); });

  // Гасим стрелку, когда листать в её сторону больше нечего.
  function sync(){
    var max=strip.scrollWidth-strip.clientWidth-1;
    prev.disabled = strip.scrollLeft<=0;
    next.disabled = strip.scrollLeft>=max;
  }
  strip.addEventListener('scroll',sync);
  window.addEventListener('resize',sync);
  sync();

  // Колесо мыши над лентой листает её вбок, а не крутит страницу.
  strip.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
    if(strip.scrollWidth<=strip.clientWidth) return;
    e.preventDefault(); strip.scrollLeft += e.deltaY;
  },{passive:false});
})();

(function(){
  // Зум в просмотрщике не должен прыгать в левый верхний угол. Сам просмотрщик
  // живёт в site.js и создаётся при первом открытии, поэтому ждём его появления
  // и следим за классом is-zoom. Запоминаем точку, куда человек нажал, и после
  // увеличения ставим прокрутку так, чтобы эта точка осталась на месте.
  var anchor = null;
  document.addEventListener('mousedown', function(e){
    var im = e.target.closest ? e.target.closest('.mp-lb-img') : null;
    if(!im) { anchor = null; return; }
    var r = im.getBoundingClientRect();
    anchor = {
      fx: (e.clientX - r.left) / (r.width || 1),   // доля по ширине
      fy: (e.clientY - r.top) / (r.height || 1),
      cx: e.clientX, cy: e.clientY
    };
  }, true);

  function centre(box){
    var stage = box.querySelector('.mp-lb-stage');
    var im = box.querySelector('.mp-lb-img');
    if(!stage || !im) return;
    var apply = function(){
      var maxX = stage.scrollWidth - stage.clientWidth;
      var maxY = stage.scrollHeight - stage.clientHeight;
      if(maxX <= 0 && maxY <= 0) return;
      var a = anchor || { fx:.5, fy:.5, cx: stage.getBoundingClientRect().left + stage.clientWidth/2,
                          cy: stage.getBoundingClientRect().top + stage.clientHeight/2 };
      var sr = stage.getBoundingClientRect();
      // Точка a.fx/a.fy внутри увеличенной картинки должна оказаться там же на
      // экране, где была до увеличения.
      stage.scrollLeft = Math.max(0, Math.min(maxX, a.fx * im.offsetWidth - (a.cx - sr.left)));
      stage.scrollTop  = Math.max(0, Math.min(maxY, a.fy * im.offsetHeight - (a.cy - sr.top)));
    };
    if(im.complete) apply(); else im.addEventListener('load', apply, { once:true });
    requestAnimationFrame(apply);
  }

  function watch(box){
    new MutationObserver(function(){
      if(box.classList.contains('is-zoom')) centre(box);
    }).observe(box, { attributes:true, attributeFilter:['class'] });
  }

  var seen = document.querySelector('.mp-lb');
  if(seen) watch(seen);
  else new MutationObserver(function(_, obs){
    var b = document.querySelector('.mp-lb');
    if(b){ watch(b); obs.disconnect(); }
  }).observe(document.body, { childList:true });
})();

/* Плеер ролика подгружается по клику: голый iframe тянул бы около мегабайта
   и ставил куки до того, как посетитель решил смотреть. */
(function(){var b=document.querySelector(".mp-video-frame");if(!b)return;b.addEventListener("click",function(){var id=b.getAttribute("data-yt");if(!id||b.dataset.on)return;b.dataset.on="1";var f=document.createElement("iframe");f.src="https://www.youtube.com/embed/"+id+"?autoplay=1&rel=0";f.title=b.getAttribute("data-title")||"Video";f.allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture";f.setAttribute("allowfullscreen","");f.loading="lazy";b.innerHTML="";b.appendChild(f);b.style.cursor="default";});})();
