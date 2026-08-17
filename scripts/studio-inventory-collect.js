/*
 * studio-inventory-collect.js — сбор картинок и техданных из нашего же
 * приложения https://www.3dmolier-studio.com/app/inventory
 *
 * Зачем. Для ~2300 новых моделей TurboSquid не отдаёт ни превью, ни
 * характеристики: выгрузка обрывается, а обход карточек упирается в защиту.
 * Всё это есть у нас самих в inventory, но за логином.
 *
 * Как устроено. Скрипт работает В БРАУЗЕРЕ, в уже открытой и авторизованной
 * вкладке приложения. Пароли и куки никуда не передаются: используется сессия,
 * которая уже есть у вкладки.
 *
 * Цепочка на одну модель:
 *   1. /api/v1/chatroles/?search=<turbosquid_id>&folder=content&store=turbosquid
 *      -> chat.data: polygons, vertices, geometry, rigged, animated,
 *         unwrapped_uvs, ntextures, details (размеры текстур), keywords,
 *         description, tags, categories, price;
 *      -> chat.attachments: файлы, среди них filetype === 'render'.
 *   2. /file/getlist/?ids[]=<file id>&... -> location: ПОЛНОРАЗМЕРНЫЙ адрес вида
 *      https://www.3dmolier-studio.com/assets/<asset>/<file>_<Имя>.jpg
 *      Проверено: этот адрес открывается БЕЗ авторизации, поэтому его можно
 *      ставить на публичный сайт. А вот /file/get/<id>/ без сессии отдаёт JSON,
 *      и для сайта он не годится.
 *
 * Запуск (в консоли вкладки inventory или через автоматизацию):
 *      invLoad([...ids])   загрузить очередь
 *      invStart()          запустить, работает в фоне вкладки
 *      invStatus()         посмотреть, сколько сделано
 *      invSave()           скачать результат в JSON
 *
 * Очередь и результат держатся в localStorage, так что перезагрузка вкладки
 * не теряет работу: после неё достаточно снова вызвать invStart().
 */
(function () {
  'use strict';

  var KEY = 'inv_collect_v1';
  var API = '/api/v1/chatroles/';
  var FILES = '/file/getlist/';
  var CONCURRENCY = 3;      // приложение само ходит по 3 — не наглеем
  var PAUSE_MS = 120;       // пауза между запросами, чтобы не долбить сервер

  var state = load();

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.queue && s.result) return s;
    } catch (e) { /* испорчено — начинаем заново */ }
    return { queue: [], result: {}, missing: [], failed: [], running: false, started: null };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('localStorage переполнен, результат только в памяти'); }
  }

  function api(id) {
    var u = new URL(API, location.origin);
    u.searchParams.set('search', id);
    u.searchParams.set('folder', 'content');
    u.searchParams.set('store', 'turbosquid');
    return fetch(u, { credentials: 'include' }).then(function (r) { return r.json(); });
  }

  // Полноразмерные адреса берём пачками: у приложения это /file/getlist/.
  function fileList(ids) {
    if (!ids.length) return Promise.resolve([]);
    var u = new URL(FILES, location.origin);
    ids.forEach(function (i) { u.searchParams.append('ids[]', i); });
    return fetch(u, { credentials: 'include' }).then(function (r) { return r.json(); });
  }

  var SPEC_FIELDS = ['polygons', 'vertices', 'geometry', 'rigged', 'animated',
    'unwrapped_uvs', 'ntextures', 'details', 'has_texture', 'has_rig', 'has_fur',
    'is_collection', 'complexity', 'price', 'recommended_price', 'keywords',
    'description', 'tags', 'categories', 'ts_categories', 'modifications',
    'filename_preffix', 'origin_geometry_id'];

  function one(id) {
    return api(id).then(function (j) {
      if (!j.count) { state.missing.push(id); return; }
      var chat = j.results[0].chat || {};
      var d = chat.data || {};
      var rec = { id: id, title: d.title || chat.title || '', images: [] };
      SPEC_FIELDS.forEach(function (f) { if (d[f] !== undefined && d[f] !== '') rec[f] = d[f]; });

      // Файлы-рендеры. Идентификатор файла лежит в хвосте url: /file/get/<id>/
      var renders = (chat.attachments || []).filter(function (a) { return a.filetype === 'render'; });
      var fids = renders.map(function (a) {
        var m = String(a.url || '').match(/\/file\/get\/([^/]+)\//);
        return m ? m[1] : null;
      }).filter(Boolean);
      if (!fids.length) { state.result[id] = rec; return; }

      return fileList(fids).then(function (files) {
        (files || []).forEach(function (f) {
          if (f && f.location) rec.images.push(f.location);
        });
        state.result[id] = rec;
      });
    }).catch(function (e) {
      state.failed.push({ id: id, error: String(e && e.message || e) });
    });
  }

  function tick() {
    if (!state.running) return;
    if (!state.queue.length) {
      state.running = false; save();
      console.log('ГОТОВО. собрано ' + Object.keys(state.result).length
        + ', нет в инвентаре ' + state.missing.length
        + ', ошибок ' + state.failed.length + '. Вызовите invSave()');
      return;
    }
    var batch = state.queue.splice(0, CONCURRENCY);
    Promise.all(batch.map(one)).then(function () {
      save();
      var done = Object.keys(state.result).length + state.missing.length;
      if (done % 50 < CONCURRENCY) console.log('обработано ' + done + ', осталось ' + state.queue.length);
      setTimeout(tick, PAUSE_MS);
    });
  }

  window.invLoad = function (ids) {
    state = { queue: ids.slice(), result: {}, missing: [], failed: [], running: false, started: Date.now() };
    save();
    return 'очередь: ' + state.queue.length;
  };
  window.invStart = function () {
    if (state.running) return 'уже идёт';
    if (!state.queue.length) return 'очередь пуста, сначала invLoad()';
    state.running = true; save(); tick();
    return 'пошло, ' + state.queue.length + ' в очереди';
  };
  window.invStop = function () { state.running = false; save(); return 'остановлено'; };
  window.invStatus = function () {
    return {
      running: state.running,
      done: Object.keys(state.result).length,
      missing: state.missing.length,
      failed: state.failed.length,
      left: state.queue.length,
    };
  };
  window.invSave = function () {
    var blob = new Blob([JSON.stringify({
      collected_at: new Date().toISOString(),
      result: state.result, missing: state.missing, failed: state.failed,
    })], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'studio-inventory.json';
    document.body.appendChild(a); a.click(); a.remove();
    return 'сохранено: ' + Object.keys(state.result).length + ' моделей';
  };
  window.invPeek = function (n) {
    var k = Object.keys(state.result).slice(0, n || 2);
    return k.map(function (i) { return state.result[i]; });
  };

  console.log('inventory collector готов: invLoad(ids) -> invStart() -> invStatus() -> invSave()');
})();
