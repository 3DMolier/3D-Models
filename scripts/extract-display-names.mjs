/*
 * extract-display-names.mjs - снять заголовки карточек в файл данных.
 *
 * ЗАЧЕМ. Заголовок склеенной карточки - имя семьи, и я попробовал вычислять его
 * заново из имён её членов. На 1 684 страницах вышло ХУЖЕ живого:
 *   «1903 Petrol Electric Autocar 3D Model» -> «1903 Electric Autocar»
 *   «20 ft ISO Container»                   -> «ISO Container»
 * Правило «оставить слова, общие для всех членов» отрезает значимое: если у
 * одного варианта в имени нет слова «Petrol», оно исчезает у всех.
 *
 * Заголовки на сайте складывались годами и правились руками. Восстановить их
 * вычислением нельзя - и не нужно: это данные, а не вывод. Снимаем их со
 * страниц один раз, как поступили с галереями.
 *
 * Вычисление familyName остаётся для НОВЫХ моделей: у них страницы ещё нет, и
 * взять заголовок неоткуда.
 *
 * Запуск:  node scripts/extract-display-names.mjs --dry
 *          node scripts/extract-display-names.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { decodeEntities } from './lib/html-entities.mjs';

import { ROOT } from './lib/paths.mjs';
const MODELS = path.join(ROOT, 'models');
const OUT = path.join(ROOT, 'data', 'model-display-name.json');
const OUT_HERO = path.join(ROOT, 'data', 'model-hero.json');
const OUT_KW = path.join(ROOT, 'data', 'model-keywords.json');
const OUT_SUB = path.join(ROOT, 'data', 'model-subtype.json');
const OUT_ANIM = path.join(ROOT, 'data', 'model-animated.json');
const OUT_VID = path.join(ROOT, 'data', 'model-video-page.json');
const DRY = process.argv.includes('--dry');

const t0 = Date.now();
/*
 * Раскодируем общим декодером, а не своим списком замен. Свой знал шесть
 * сущностей и работал в один проход - из-за этого шесть заголовков остались
 * экранированными дважды, и посетитель видел «Lady&#x27;s Bag» вместо
 * «Lady's Bag».
 */
const dec = s => decodeEntities(s).trim();

const out = {};
/*
 * Заодно снимаем главный снимок. Он тоже выбран вручную: в data/fc-img-chunk
 * у той же модели лежит ДРУГОЙ ракурс, и пересборка молча подменила бы кадр на
 * 2 273 карточках. Снимок в шапке и снимок в соцразметке - один и тот же файл,
 * так что достаточно взять один.
 */
const hero = {};
/*
 * И ключевые слова. Они на страницах написаны ФРАЗАМИ - «naval defence asset»,
 * «cold war vessel model», - а в выгрузке студии лежат отдельными словами.
 * Собрать фразы из слов нельзя, а фразы полезнее: по ним ищут.
 */
const kws = {};
/*
 * И две строки характеристик, которых нет ни в одном источнике данных.
 *
 * «Type» - подтип модели: «Medicine», «Large Truck», «Industrial Container».
 * Он есть у 1 097 карточек, собранных build-new-cards.mjs из выгрузки студии,
 * и больше нигде: в Excel этих моделей нет вовсе. Без снятия пересборка
 * потеряла бы строку молча.
 *
 * «Animation» - признак анимации. Нужен только положительный: «model is not
 * animated» это отрицание, оно не сообщает ничего. Положительных 173.
 *
 * Значения «#N/A» пропускаем: это несчитанная формула, а не подтип.
 */
const sub = {};
const anim = {};
const vid = {};
const rowOf = (h, key) => {
  const m = h.match(new RegExp('<tr><th[^>]*>' + key + '</th><td[^>]*>([^<]*)<'));
  return m ? dec(m[1]) : '';
};
let live = 0, taken = 0, noH1 = 0, heroTaken = 0, kwTaken = 0, subTaken = 0, animTaken = 0, vidTaken = 0;
for (const d of fs.readdirSync(MODELS)) {
  let h;
  try { h = fs.readFileSync(path.join(MODELS, d, 'index.html'), 'utf8'); } catch (e) { continue; }
  if (/http-equiv="refresh"/i.test(h.slice(0, 400))) continue;
  live++;
  const m = h.match(/<h1[^>]*>([^<]*)</);
  if (!m) { noH1++; continue; }
  const name = dec(m[1]);
  if (!name) { noH1++; continue; }
  out[d] = name;
  taken++;
  const hm = h.match(/<img src="([^"]*)"[^>]*class="mp-hero-img"/)
    || h.match(/og:image" content="([^"]*)"/);
  /*
 * Раскодировать адрес обязательно. Подписанные адреса студии несут «&amp;»
 * между параметрами; положи их в запись как есть - генератор экранирует
 * второй раз, выйдет «&amp;amp;», и картинка отдаст 403 при живой разметке.
 */
  if (hm && hm[1]) { hero[d] = dec(hm[1]); heroTaken++; }
  const list = [...h.matchAll(/class="chip chip--kw">([^<]*)</g)].map(x => dec(x[1])).filter(Boolean);
  if (list.length) { kws[d] = list; kwTaken++; }

  const t = rowOf(h, 'Type');
  if (t && !/#N\/A/i.test(t)) { sub[d] = t; subTaken++; }
  if (/^animated$/i.test(rowOf(h, 'Animation'))) { anim[d] = true; animTaken++; }

  /*
   * Ролик. Основной источник - журнал публикаций YouTube, но у 25 карточек
   * ролик на странице есть, а в журнале его нет: их привязывали руками.
   * Снимаем как запасной источник, чтобы блок не пропал при пересборке.
   */
  const v = h.match(/data-yt="([^"]+)" data-title="([^"]*)"/);
  if (v) { vid[d] = { id: v[1], title: dec(v[2]) }; vidTaken++; }
}

console.log('живых карточек: ' + live.toLocaleString('ru-RU')
  + ', заголовков снято: ' + taken.toLocaleString('ru-RU')
  + (noH1 ? ', без заголовка: ' + noH1 : '')
  + ', снимков: ' + heroTaken.toLocaleString('ru-RU')
  + ', наборов ключевых слов: ' + kwTaken.toLocaleString('ru-RU')
  + ', подтипов: ' + subTaken.toLocaleString('ru-RU')
  + ', анимированных: ' + animTaken.toLocaleString('ru-RU')
  + ', роликов: ' + vidTaken.toLocaleString('ru-RU'));
if (!DRY) {
  fs.writeFileSync(OUT, JSON.stringify(out));
  fs.writeFileSync(OUT_HERO, JSON.stringify(hero));
  fs.writeFileSync(OUT_KW, JSON.stringify(kws));
  fs.writeFileSync(OUT_SUB, JSON.stringify(sub));
  fs.writeFileSync(OUT_ANIM, JSON.stringify(anim));
  fs.writeFileSync(OUT_VID, JSON.stringify(vid));
  console.log('записано: model-display-name.json, model-hero.json, model-keywords.json,');
  console.log('          model-subtype.json, model-animated.json, model-video-page.json');
} else console.log('(--dry, ничего не записано)');
console.log('время: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
