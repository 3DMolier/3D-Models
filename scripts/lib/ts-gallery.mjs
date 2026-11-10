/*
 * ts-gallery.mjs - галереи карточек из превью TurboSquid (решение основателя 10.11.2026).
 *
 * Кадры студии (www.3dmolier-studio.com/assets/) с ~08.11.2026 не отдаются - галереи ~30 тыс. карточек пустые.
 * Превью TurboSquid на p.turbosquid.com - те же рендеры, и CDN работает. Галереи готовит
 * C:\Clode_Work_Folder\tools\turbosquid\gallery_classify.py: до 12 рендеров, затем до 4 технических кадров
 * (сетка, «Mesh & UV», текстуры и развёртка, окно программы) с меткой. Файл ts-gallery.jsonl локальный, как
 * выгрузка студии: адреса 38 тыс. товаров - это сотни мегабайт, в репозиторий и в data/ сайта они не идут.
 * На сайт галерея попадает только для номеров из data/ts-gallery-released.json - выпуск частями
 * (scripts/release-ts-gallery.mjs), чтобы ежедневная публикация оставалась ниже потолка 5 000 карточек.
 *
 * Строка ts-gallery.jsonl: {"id","g":[[адрес без начала, подпись миниатюры 600 px, код]]}, код '' - рендер.
 * Сжатие адресов - tools/turbosquid/ts-preview-codec.mjs (то же правило, что decode ниже).
 */
import fs from 'node:fs';
import path from 'node:path';

export const TS_GALLERY = 'C:/Clode_Work_Folder/tools/turbosquid/ts-gallery.jsonl';
const PFX = 'https://p.turbosquid.com/ts-thumb/';
const BIG = /\/1920x1080\/([a-z0-9_]+)\/[0-9a-f]{40}\//;
// «UV layout» и «Textures» по картинке путались - одна подпись (проверка 87 кадров 10.11.2026)
export const TS_CAP = { wire: 'Wireframe', tri: 'Mesh & UV', uv: 'Textures & UV', vp: 'Viewport' };

export function decode(us, ms) {
  const u = /^https?:/.test(us) ? us : PFX + us;
  if (!ms) return { u, m: '' };
  if (/^[0-9a-f]{40}$/.test(ms)) return { u, m: u.replace(BIG, (x, mode) => '/600x600/' + mode + '/' + ms + '/') };
  return { u, m: ms };
}

/** Номера в порядке разметки (= порядок сбора: сначала карточки без данных студии, потом индексируемые). */
export function tsGalleryIds() {
  if (!fs.existsSync(TS_GALLERY)) return [];
  const ids = [];
  for (const line of fs.readFileSync(TS_GALLERY, 'utf8').split('\n')) {
    const m = line.match(/^\{"id": ?"(\d+)", ?"g": ?\[(.)/);
    if (m && m[2] !== ']') ids.push(m[1]);       // пустая галерея (у товара нет превью) не выпускается
  }
  return ids;
}

/** Галереи для набора номеров: Map номер -> [{url, thumb, cap, tag}] в формате записи карточки. */
export function readTsGalleries(wanted) {
  const out = new Map();
  if (!fs.existsSync(TS_GALLERY) || !wanted.size) return out;
  for (const line of fs.readFileSync(TS_GALLERY, 'utf8').split('\n')) {
    const m = line.match(/^\{"id": ?"(\d+)"/);
    if (!m || !wanted.has(m[1])) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    const g = (rec.g || []).map(([us, ms, code]) => {
      const { u, m: thumb } = decode(us, ms);
      const tag = TS_CAP[code] || '';
      return { url: u, thumb, cap: tag, tag };
    });
    if (g.length) out.set(m[1], g);
  }
  return out;
}

export const releasedFile = root => path.join(root, 'data', 'ts-gallery-released.json');
export function readReleased(root) {
  try { return JSON.parse(fs.readFileSync(releasedFile(root), 'utf8')).map(String); } catch { return []; }
}
