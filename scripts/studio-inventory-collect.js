/*
 * studio-inventory-collect.js — сбор картинок и техданных из нашего же
 * приложения https://www.3dmolier-studio.com/app/inventory
 *
 * Зачем. Для новых моделей TurboSquid не отдаёт ни превью, ни характеристик:
 * выгрузка обрывается, а обход карточек упирается в защиту. Всё это есть у нас
 * самих в inventory, но за логином.
 *
 * Как устроено. Скрипт работает В БРАУЗЕРЕ, в уже открытой и авторизованной
 * вкладке приложения. Пароли и куки никуда не передаются: используется сессия,
 * которая уже есть у вкладки.
 *
 * ПОЧЕМУ ПОСТРАНИЧНО, А НЕ ПО СПИСКУ (переделано 19.08).
 * Первые две версии спрашивали приложение про каждую модель отдельно:
 * /api/v1/chatroles/?search=<turbosquid_id>. Это 58 512 запросов по ~3.1 с
 * каждый и 600 КБ списка идентификаторов, который надо было как-то передать в
 * страницу. Оказалось, тот же эндпоинт умеет отдавать всё подряд постранично
 * (?page=N, по 20 записей, count = 73 708), и в каждой записи УЖЕ лежат и
 * chat.data со всеми характеристиками, и chat.attachments с рендерами.
 * Значит на 20 моделей хватает одного запроса вместо двадцати: ~3 700 страниц
 * плюс столько же запросов за адресами файлов - около 7 400 обращений вместо
 * 58 512. Это в восемь раз меньше нагрузки на приложение, где работают люди.
 * Заодно отпала передача списка идентификаторов: обход идёт по номеру страницы.
 * Оговорка: ?page_size= сервер не принимает (500), размер страницы всегда 20.
 *
 * Адреса картинок. В attachments лежит /file/get/<id>/, который без сессии
 * отдаёт JSON и для сайта не годится. Полноразмерный публичный адрес даёт
 * /file/getlist/?ids[]=... -> location вида
 * https://www.3dmolier-studio.com/assets/<asset>/<file>_<Имя>.jpg
 * Он открывается без авторизации, поэтому его можно ставить на публичный сайт.
 * Файлы возвращаются с полем id, так что картинки привязываются к своей модели
 * без догадок. За одну страницу это один общий запрос на все её рендеры.
 *
 * ГДЕ ЛЕЖИТ РЕЗУЛЬТАТ. В IndexedDB, а не в localStorage. Первая версия держала
 * весь результат одним куском в localStorage и пересохраняла его после каждой
 * пачки. На 1475 моделях это 8.9 МБ, то есть ~6 КБ на модель; на полном объёме
 * вышло бы ~350 МБ при лимите localStorage около 5 МБ. Запись переставала
 * помещаться, скрипт продолжал копить в памяти, вкладка разрослась до 810 МБ и
 * перестала отвечать - ночной прогон 18.08 пропал целиком. Теперь каждая модель
 * пишется в IndexedDB отдельной записью, а в localStorage остаётся только номер
 * страницы и счётчики. Память не растёт, перезагрузка вкладки ничего не теряет.
 *
 * Запуск (в консоли вкладки inventory или через автоматизацию):
 *      invStart()                пойти с той страницы, где остановились
 *      await invStatus()         сколько собрано
 *      invStop()                 остановить
 *      await invSave()           выгрузить файлами по 5000 моделей
 *      await invReset()          начать обход с первой страницы (данные целы)
 */
(function () {
  'use strict';

  var KEY = 'inv_walk_v3';
  var API = '/api/v1/chatroles/';
  var FILES = '/file/getlist/';
  var DB_NAME = 'inv_collect';
  var STORE = 'recs';
  var PART = 5000;          // моделей в одном файле выгрузки
  var FID_BATCH = 100;      // сколько адресов файлов просим за один раз

  // Страница со списком стоит серверу дорого: замер дал медиану ~3.1 с. Днём
  // идём в ОДИН поток - в приложении работают люди, и очередь к базе важнее
  // нашей скорости. Ночью там никого нет, можно в три. Переключение в 23:00 и
  // в 07:00: к восьми утра люди уже работают, поэтому возвращаемся к щадящему
  // режиму заранее.
  var NIGHT_FROM = 23, NIGHT_TO = 7;
  function isNight() {
    var h = new Date().getHours();
    return h >= NIGHT_FROM || h < NIGHT_TO;
  }
  function concurrency() { return isNight() ? 3 : 1; }
  function pauseMs() { return isNight() ? 120 : 400; }
  // Самозащита: если сервер начал отвечать заметно медленнее обычного, значит на
  // нём появилась чужая нагрузка - отходим в сторону сами, не дожидаясь жалоб.
  var SLOW_FACTOR = 1.6;
  var BACKOFF_MS = 60000;

  // ── хранилище ─────────────────────────────────────────────────────────────
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  // Всю страницу пишем одной транзакцией: так на 20 моделей приходится одна
  // запись на диск, а не двадцать.
  function putMany(recs) {
    if (!recs.length) return Promise.resolve();
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, 'readwrite');
        var s = t.objectStore(STORE);
        recs.forEach(function (r) { s.put(r); });
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function count() {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction(STORE, 'readonly').objectStore(STORE).count();
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  // Читаем порциями через курсор: getAll() на всём объёме поднял бы в память то
  // самое, от чего мы здесь и уходим.
  function slice(from, n) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var out = [], skipped = 0;
        var r = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        r.onsuccess = function () {
          var c = r.result;
          if (!c) return res(out);
          if (skipped < from) { skipped++; c.continue(); return; }
          out.push(c.value);
          if (out.length >= n) return res(out);
          c.continue();
        };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  // В localStorage - только номер страницы и счётчики. Килобайты, не мегабайты.
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s.page === 'number') return s;
    } catch (e) { /* испорчено — начинаем заново */ }
    return { page: 1, lastPage: 0, total: 0, noTsid: 0, failed: [],
      running: false, started: null, lat: [], base: 0, backoffs: 0, night: null };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('состояние не сохранилось: ' + e.name + '. Результат в IndexedDB цел.'); }
  }

  function noteLatency(ms) {
    state.lat.push(ms);
    if (state.lat.length > 40) state.lat.shift();
    if (!state.base && state.lat.length >= 8) {
      var sorted = state.lat.slice().sort(function (a, b) { return a - b; });
      state.base = sorted[Math.floor(sorted.length / 2)];
      console.log('базовый отклик сервера: ' + state.base + ' мс');
    }
  }
  function serverBusy() {
    if (!state.base || state.lat.length < 4) return false;
    var last = state.lat.slice(-4);
    var avg = last.reduce(function (a, b) { return a + b; }, 0) / last.length;
    return avg > state.base * SLOW_FACTOR;
  }

  function fetchPage(n) {
    var t0 = Date.now();
    var u = new URL(API, location.origin);
    u.searchParams.set('folder', 'content');
    u.searchParams.set('store', 'turbosquid');
    u.searchParams.set('page', n);
    return fetch(u, { credentials: 'include' }).then(function (r) {
      noteLatency(Date.now() - t0);
      if (!r.ok) throw new Error('страница ' + n + ': HTTP ' + r.status);
      return r.json();
    });
  }

  function fileList(ids) {
    if (!ids.length) return Promise.resolve([]);
    var chunks = [];
    for (var i = 0; i < ids.length; i += FID_BATCH) chunks.push(ids.slice(i, i + FID_BATCH));
    var out = [];
    return chunks.reduce(function (chain, part) {
      return chain.then(function () {
        var u = new URL(FILES, location.origin);
        part.forEach(function (i) { u.searchParams.append('ids[]', i); });
        return fetch(u, { credentials: 'include' })
          .then(function (r) { return r.json(); })
          .then(function (files) { if (Array.isArray(files)) out = out.concat(files); });
      });
    }, Promise.resolve()).then(function () { return out; });
  }

  var SPEC_FIELDS = ['polygons', 'vertices', 'geometry', 'rigged', 'animated',
    'unwrapped_uvs', 'ntextures', 'details', 'has_texture', 'has_rig', 'has_fur',
    'is_collection', 'complexity', 'price', 'recommended_price', 'keywords',
    'description', 'tags', 'categories', 'ts_categories', 'modifications',
    'filename_preffix', 'origin_geometry_id'];

  // Разбираем одну страницу: собираем записи и заодно список файлов, за
  // адресами которых сходим одним общим запросом.
  function handlePage(j) {
    var recs = [], fids = [], owner = {};
    (j.results || []).forEach(function (row) {
      var chat = row.chat || {}, d = chat.data || {};
      var tsid = d.turbosquid_product_id;
      if (!tsid) { state.noTsid++; return; }
      var rec = { id: String(tsid), title: d.title || chat.title || '', images: [], files: [] };
      SPEC_FIELDS.forEach(function (f) { if (d[f] !== undefined && d[f] !== '') rec[f] = d[f]; });
      (chat.attachments || []).forEach(function (a) {
        var isRender = a.filetype === 'render';
        var m = String(a.url || '').match(/\/file\/get\/([^/]+)\//);
        if (!m) return;
        fids.push(m[1]);
        if (isRender) { owner[m[1]] = { rec: rec, render: true }; return; }
        // Не рендер - значит сам файл модели, а формат зашит в его имя
        // (..._max_vray.zip, ..._fbx.zip, ..._c4d.zip). Ячейку заводим сразу:
        // если у вложения уже есть имя, запомнится оно, а если нет - имя
        // подставится ниже из ответа /file/getlist/. Так формат не теряется,
        // даже когда публичного адреса у файла нет.
        var slot = { name: String(a.filename || a.name || a.title || ''), filetype: String(a.filetype || '') };
        rec.files.push(slot);
        owner[m[1]] = { rec: rec, render: false, slot: slot };
      });
      recs.push(rec);
    });
    return fileList(fids).then(function (files) {
      files.forEach(function (f) {
        if (!f || !f.location) return;
        var o = owner[f.id];
        if (!o) return;
        if (o.render) { o.rec.images.push(f.location); return; }
        // Храним имя файла целиком, а не свою догадку о формате: правило
        // разбора имени можно будет поменять, не собирая инвентарь заново.
        if (!o.slot.name) o.slot.name = String(f.location).split('?')[0].split('/').pop();
      });
      return putMany(recs).then(function () { return recs.length; });
    });
  }

  function tick() {
    if (!state.running) return;
    if (state.lastPage && state.page > state.lastPage) {
      state.running = false; save();
      count().then(function (n) {
        console.log('ГОТОВО. в базе ' + n + ' моделей, без turbosquid_id пропущено '
          + state.noTsid + ', ошибок ' + state.failed.length + '. Вызовите await invSave()');
      });
      return;
    }
    if (serverBusy()) {
      state.backoffs++;
      console.log('сервер отвечает медленнее обычного, пауза ' + (BACKOFF_MS / 1000) + ' с (отходов: ' + state.backoffs + ')');
      state.lat = [];
      save();
      setTimeout(tick, BACKOFF_MS);
      return;
    }
    var nightNow = isNight();
    if (state.night !== nightNow) {
      state.night = nightNow;
      console.log(nightNow ? 'ночь: ускоренный режим, 3 страницы разом' : 'день: щадящий режим, 1 страница');
      // База отклика меряется заново: в разных режимах она разная, иначе
      // самозащита сработает на смене режима, а не на чужой нагрузке.
      state.lat = []; state.base = 0;
    }

    var pages = [];
    for (var k = 0; k < concurrency(); k++) {
      var p = state.page + k;
      if (state.lastPage && p > state.lastPage) break;
      pages.push(p);
    }
    var from = state.page;
    Promise.all(pages.map(function (p) {
      return fetchPage(p).then(function (j) {
        // Сколько всего страниц, узнаём с первого же ответа.
        if (!state.lastPage && j.count) {
          state.total = j.count;
          state.lastPage = Math.ceil(j.count / 20);
          console.log('в инвентаре ' + j.count + ' записей, страниц ' + state.lastPage);
        }
        return handlePage(j);
      }).catch(function (e) {
        state.failed.push({ page: p, error: String(e && e.message || e) });
      });
    })).then(function () {
      // Страницу сдвигаем только после успешной записи: сбой на середине
      // означает повтор этой же страницы, а не пропуск.
      state.page = from + pages.length;
      save();
      if (state.page % 100 < pages.length) {
        count().then(function (n) {
          console.log('страница ' + state.page + ' из ' + state.lastPage + ', в базе ' + n + ' моделей');
        });
      }
      setTimeout(tick, pauseMs());
    });
  }

  window.invStart = function () {
    if (state.running) return 'уже идёт';
    state.running = true;
    if (!state.started) state.started = Date.now();
    save(); tick();
    return 'пошло со страницы ' + state.page + (state.lastPage ? ' из ' + state.lastPage : '');
  };
  window.invStop = function () { state.running = false; save(); return 'остановлено на странице ' + state.page; };
  window.invReset = function () {
    state = { page: 1, lastPage: 0, total: 0, noTsid: 0, failed: [], running: false,
      started: null, lat: [], base: 0, backoffs: 0, night: null };
    save();
    return 'обход начнётся с первой страницы, собранные данные не тронуты';
  };
  window.invStatus = function () {
    return count().then(function (n) {
      return {
        running: state.running,
        collected: n,
        page: state.page,
        lastPage: state.lastPage,
        total: state.total,
        noTsid: state.noTsid,
        failed: state.failed.length,
        baseMs: state.base,
        backoffs: state.backoffs,
        mode: isNight() ? 'ночной (3 страницы)' : 'щадящий (1 страница)',
      };
    });
  };

  function download(name, obj) {
    var blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  // Выгрузка файлами по PART моделей: один файл на всё снова упёрся бы в память.
  window.invSave = function () {
    return count().then(function (n) {
      var parts = Math.max(1, Math.ceil(n / PART));
      var chain = Promise.resolve();
      for (var p = 0; p < parts; p++) {
        (function (p) {
          chain = chain.then(function () {
            return slice(p * PART, PART).then(function (rows) {
              var res = {};
              rows.forEach(function (r) { res[r.id] = r; });
              download('studio-inventory-part-' + String(p + 1).padStart(3, '0') + '.json', {
                collected_at: new Date().toISOString(),
                part: p + 1, parts: parts,
                result: res,
                failed: p === 0 ? state.failed : [],
              });
              // Пауза между файлами: браузер иначе глушит подряд идущие скачивания.
              return new Promise(function (r) { setTimeout(r, 800); });
            });
          });
        })(p);
      }
      return chain.then(function () { return 'выгружено ' + n + ' моделей в ' + parts + ' файлов'; });
    });
  };
  window.invPeek = function (n) { return slice(0, n || 2); };

  console.log('inventory walker v3 готов: invStart() -> await invStatus() -> await invSave()');
})();
