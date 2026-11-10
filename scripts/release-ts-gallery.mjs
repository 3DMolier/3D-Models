/*
 * release-ts-gallery.mjs - выпустить на сайт следующие N галерей из превью TurboSquid (10.11.2026).
 *
 * Дописывает номера в data/ts-gallery-released.json в порядке разметки (сначала карточки без данных студии,
 * у которых галереи не было вовсе, потом индексируемые, потом остальные). build-model-records.mjs ставит
 * галерею TurboSquid только этим номерам. Ежедневная публикация вызывает с --limit, чтобы вместе с ночными
 * текстами и характеристиками остаться ниже потолка 5 000 изменённых карточек.
 *
 *   node scripts/release-ts-gallery.mjs --limit 2800 [--dry]
 */
import fs from 'node:fs';
import { ROOT } from './lib/paths.mjs';
import { tsGalleryIds, readReleased, releasedFile } from './lib/ts-gallery.mjs';

const args = process.argv.slice(2);
const li = args.indexOf('--limit'); const LIMIT = li >= 0 ? +args[li + 1] : 0;
const DRY = args.includes('--dry');
const ready = tsGalleryIds();
const released = readReleased(ROOT);
const have = new Set(released);
const add = ready.filter(id => !have.has(id)).slice(0, LIMIT);
console.log(`галереи TurboSquid: готово ${ready.length}, выпущено ${released.length}, выпускаю ${add.length}`
  + (DRY ? ' (--dry, не записано)' : ''));
if (!DRY && add.length) fs.writeFileSync(releasedFile(ROOT), JSON.stringify([...released, ...add]) + '\n');
