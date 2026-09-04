/*
 * add-about-clients.mjs - полоса заказчиков в разделе About.
 *
 * ПУНКТ 14 СПИСКА. Под текстом «Who Has Commissioned Us» имена заказчиков были
 * перечислены строкой в абзаце и терялись. Ставим их отдельной полосой -
 * человек видит их сразу, не вчитываясь.
 *
 * ПОЧЕМУ НАДПИСИ, А НЕ КАРТИНКИ-ЛОГОТИПЫ. Настоящих логотипов у нас нет: файлов
 * в репозитории нет, скачивать их со стороны запрещено правилами репозитория, а
 * рисовать похожие - это подделка чужого товарного знака. Плюс само размещение
 * чужих логотипов - вопрос разрешения от этих компаний, и решать его не мне.
 * Поэтому имена набраны единым начертанием: та же наглядность, без чужих
 * знаков. Если ты пришлёшь файлы логотипов и подтвердишь право их показывать,
 * подставлю их сюда же - разметка уже готова.
 *
 * Запуск:  node scripts/add-about-clients.mjs --dry
 *          node scripts/add-about-clients.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');
const FILE = path.join(ROOT, 'about', 'index.html');

// Имена берём из самого абзаца - чтобы полоса не разошлась с текстом.
const CLIENTS = ['Google', 'Microsoft', 'Delta Air Lines', 'Capcom', 'Autodesk', 'IKEA'];

let h = fs.readFileSync(FILE, 'utf8');
if (/about-clients/.test(h)) { console.log('полоса уже есть'); process.exit(0); }

const paragraph = h.match(/<h2 class="section-h2 section-h2--mb16">Who Has Commissioned Us<\/h2>\s*<p class="about-text">[\s\S]*?<\/p>/);
if (!paragraph) { console.log('раздел не найден'); process.exit(1); }

// Сверяем, что все имена действительно есть в тексте: полоса не должна
// добавлять заказчиков, которых страница не называет.
const missing = CLIENTS.filter(c => !paragraph[0].includes(c));
if (missing.length) { console.log('в тексте нет: ' + missing.join(', ')); process.exit(1); }

const strip = '<div class="about-clients" aria-label="Companies that commissioned work">'
  + CLIENTS.map(c => '<span class="about-client">' + c + '</span>').join('')
  + '</div>';

h = h.replace(paragraph[0], paragraph[0] + strip);

// стили - в тот же <style>, где остальные правила страницы
if (!/about-clients\{/.test(h)) {
  h = h.replace('</style>',
    '.about-clients{display:flex;flex-wrap:wrap;gap:12px 28px;align-items:center;margin-top:20px;'
    + 'padding-top:20px;border-top:1px solid rgba(0,0,0,.10)}'
    + ".about-client{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;letter-spacing:-.01em;"
    + 'color:#111;opacity:.62;white-space:nowrap}'
    + '@media(prefers-color-scheme:dark){.about-clients{border-top-color:rgba(255,255,255,.16)}'
    + '.about-client{color:#fff;opacity:.72}}'
    + '@media(max-width:520px){.about-client{font-size:17px}}'
    + '</style>');
}

if (!DRY) fs.writeFileSync(FILE, h);
console.log('полоса заказчиков добавлена: ' + CLIENTS.length + ' имён' + (DRY ? '  (--dry)' : ''));
