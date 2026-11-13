/*
 * section-texts.mjs - рукописные тексты разделов (категорий и подкатегорий), 13.11.2026.
 *
 * Задание основателя: уникальный текст 200-400 слов на каждую категорию и подкатегорию вместо одной шаблонной
 * фразы. Тексты лежат в данных под git - data/category-texts.json (правило «авторский текст в данных, не в
 * разметке»), страницу собирает генератор. Устройство страницы - по образцам 09.11.2026
 * (plans/2026-11-09-category-text-samples.md): первый абзац (lead) встаёт на место строки под заголовком,
 * остальные (body) - блоком «About ... 3D Models» под сеткой моделей, чтобы покупатель сначала видел модели.
 *
 * Изменчивых чисел в тексте нет: количество моделей подставляется при сборке из метки {count}
 * (правило репо - не хардкодить динамику). Продажи не упоминаются вовсе.
 *
 * Ключ: слаг категории («aircraft») или «категория/подкатегория» («aircraft/helicopters»).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(ROOT, 'data', 'category-texts.json');
let TEXTS = null;
const load = () => {
  if (TEXTS) return TEXTS;
  try { TEXTS = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { TEXTS = {}; }
  return TEXTS;
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (s, count) => String(s).replace(/\{count\}/g, Number(count || 0).toLocaleString('en-US'));

/** Текст раздела или null. */
export const sectionText = id => { const t = load()[id]; return t && t.lead ? t : null; };

/** Первый абзац (уже экранированный, с подставленным числом) или '' - тогда генератор оставляет прежнюю строку. */
export const sectionLead = (id, count) => { const t = sectionText(id); return t ? esc(fill(t.lead, count)) : ''; };

/** Блок под сеткой: заголовок и абзацы. '' - текста нет. */
export function sectionAbout(id, count) {
  const t = sectionText(id);
  if (!t || !(t.body || []).length) return '';
  return `<section class="page-section cat-about"><div class="max-w-7xl mx-auto">`
    + `<h2 class="section-h2 cat-about-h2">${esc(t.h2)}</h2>`
    + `<div class="cat-about-text">${t.body.map(p => `<p>${esc(fill(p, count))}</p>`).join('')}</div>`
    + `</div></section>`;
}

/* Оформление блока: страницы разделов несут свой <style>, styles.min.css не трогаем. */
export const SECTION_TEXT_CSS = '.cat-about{padding-top:8px}.cat-about-h2{margin-bottom:16px}'
  + '.cat-about-text{max-width:760px}.cat-about-text p{margin:0 0 16px;line-height:1.7;font-size:16px;opacity:.88}';
