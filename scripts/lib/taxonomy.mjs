/*
 * taxonomy.mjs - чтение единого источника категорий.
 *
 * Правило простое: ни один скрипт и ни одна страница не хранят имя категории
 * у себя. Всё берётся отсюда. До этого имя жило в четырёх местах сразу, и они
 * разошлись: у `ships` заголовок страницы говорил «Ship & Boat», чип в сетке -
 * «Ships», меню - «Ships»; у `nature-plants` - «Nature & Plant» против
 * «Nature & Plants». Разошлись 11 категорий из 26.
 *
 * Файлы:
 *   data/taxonomy.json          - 26 категорий: id, slug, name, menu_short
 *   data/model-categories.json  - номер модели -> slug категории
 *
 * Колонка g в data/fc-chunk-*.json - это id из taxonomy.json, а не порядковый
 * номер в массиве. Менять id нельзя: сломается фильтр каталога и поиск.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/3d/документы/Blogger/Clode_and_Gpt_Website';
const DATA = path.join(ROOT, 'data');

const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'taxonomy.json'), 'utf8'));
export const CATEGORIES = raw.categories;

const bySlug = new Map(CATEGORIES.map(c => [c.slug, c]));
const byId = new Map(CATEGORIES.map(c => [c.id, c]));

export const catBySlug = s => bySlug.get(s) || null;
export const catById = i => byId.get(i) || null;

/** Имя категории для показа человеку - одно на все поверхности. */
export const nameOf = slug => (bySlug.get(slug) || {}).name || slug;
/** Короткое имя для выпадающего меню, если полное не помещается. */
export const menuNameOf = slug => {
  const c = bySlug.get(slug);
  return c ? (c.menu_short || c.name) : slug;
};
/** Заголовок страницы категории. Не хранится, всегда собирается из имени. */
export const h1Of = slug => nameOf(slug) + ' 3D Models';
/** Для HTML: амперсанд в имени обязан быть мнемоникой. */
export const escName = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Номер модели -> slug категории. Единственный ответ на вопрос «где лежит». */
export function loadModelCategories() {
  const f = path.join(DATA, 'model-categories.json');
  if (!fs.existsSync(f)) throw new Error('нет ' + f + ' - собрать через scripts/build-taxonomy.mjs');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
