/*
 * formats.mjs - формат модели из имени загруженного файла.
 *
 * Откуда правило. На студийном сайте у каждой модели лежит список загруженных
 * файлов, и это и есть форматы: сколько файлов - столько форматов, а окончание
 * имени и есть сам формат («..._max_vray.zip», «..._fbx.zip», «..._c4d.zip»).
 * Ничего другого - ни models_master.csv, ни карточек TurboSquid - про форматы
 * не знает, там таких колонок просто нет.
 *
 * Почему не «последнее слово после подчёркивания». Половина форматов состоит
 * из двух слов: max_vray, c4d_octane, blend_cycles. Взять только последнее -
 * и вместо «3ds Max + V-Ray» получится просто «V-Ray», то есть рендер вместо
 * пакета. Поэтому идём с конца имени и набираем подряд идущие слова, пока они
 * знакомы по словарю; первое незнакомое - граница между названием модели и
 * форматом.
 *
 * Что делать с незнакомым окончанием. Не выбрасывать и не угадывать: такие
 * имена возвращаются отдельным списком, чтобы их можно было глазами посмотреть
 * и дописать в словарь. Молча показать читателю выдуманный формат хуже, чем
 * не показать никакого.
 */

// Пакеты моделирования и обменные форматы.
const APPS = {
  max: '3ds Max', '3dsmax': '3ds Max', '3ds': '3DS',
  ma: 'Maya', mb: 'Maya', maya: 'Maya',
  c4d: 'Cinema 4D', cinema4d: 'Cinema 4D',
  blend: 'Blender', blender: 'Blender',
  lwo: 'Lightwave', lws: 'Lightwave', lightwave: 'Lightwave',
  lxo: 'Modo', modo: 'Modo',
  skp: 'SketchUp', sketchup: 'SketchUp',
  hip: 'Houdini', hiplc: 'Houdini', houdini: 'Houdini',
  ztl: 'ZBrush', zbrush: 'ZBrush',
  unitypackage: 'Unity', unity: 'Unity',
  uasset: 'Unreal Engine', upk: 'Unreal Engine', unreal: 'Unreal Engine',
  fbx: 'FBX', obj: 'OBJ', dae: 'Collada', collada: 'Collada',
  stl: 'STL', ply: 'PLY', abc: 'Alembic', alembic: 'Alembic',
  usd: 'USD', usda: 'USD', usdc: 'USD', usdz: 'USDZ',
  glb: 'glTF', gltf: 'glTF',
  dxf: 'DXF', dwg: 'DWG', x3d: 'X3D', wrl: 'VRML', vrml: 'VRML',
  step: 'STEP', stp: 'STEP', iges: 'IGES', igs: 'IGES',
  sldprt: 'SolidWorks', sldasm: 'SolidWorks', solidworks: 'SolidWorks',
  ipt: 'Inventor', catpart: 'CATIA', '3dm': 'Rhino', rhino: 'Rhino',
  sbsar: 'Substance', spp: 'Substance Painter',
};

// Рендеры: сами по себе форматом не бывают, только приставкой к пакету.
const RENDERERS = {
  vray: 'V-Ray', vrayrt: 'V-Ray', corona: 'Corona', scanline: 'Scanline',
  arnold: 'Arnold', redshift: 'Redshift', octane: 'Octane', cycles: 'Cycles',
  eevee: 'Eevee', mentalray: 'Mental Ray', mental: 'Mental Ray',
  renderman: 'RenderMan', keyshot: 'KeyShot', standard: 'Standard',
};

// Слова, которые в окончании ничего не значат и только мешают.
const NOISE = new Set(['zip', 'rar', '7z', 'gz', 'tar', 'file', 'files',
  'model', 'models', 'archive', 'final', 'new', 'v1', 'v2', 'v3']);

const VOCAB = new Set([...Object.keys(APPS), ...Object.keys(RENDERERS)]);

/** Разбирает одно имя файла. Возвращает null, если формат не опознан. */
export function formatFromFilename(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;

  // Отрезаем расширение архива, но только его: «...max_vray.zip» -> «...max_vray».
  let base = raw.replace(/\.(zip|rar|7z|gz|tgz|tar)$/i, '');

  const parts = base.split(/[._\-\s]+/).filter(Boolean).map(s => s.toLowerCase());
  if (!parts.length) return null;

  // Идём с конца, пропуская мусорные слова и набирая знакомые.
  const tail = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (NOISE.has(p)) { if (tail.length) break; continue; }
    if (!VOCAB.has(p)) break;
    tail.unshift(p);
  }
  if (!tail.length) return { key: null, label: null, raw: raw, unknown: parts[parts.length - 1] };

  // Пакет - первое знакомое слово, остальное считаем рендером.
  const app = tail.find(p => APPS[p]);
  const rends = tail.filter(p => RENDERERS[p] && p !== app);
  const label = app
    ? APPS[app] + (rends.length ? ' + ' + [...new Set(rends.map(r => RENDERERS[r]))].join(' + ') : '')
    // Рендер без пакета - это не формат, показывать такое нельзя.
    : null;

  return { key: tail.join('_'), label, raw, unknown: label ? null : tail.join('_') };
}

/**
 * Разбирает список файлов модели.
 * files: [{ name, filetype }] из studio-inventory-collect.js.
 * Возвращает { formats, count, unknown }:
 *   formats - подписи без повторов, в том порядке, как встретились;
 *   count   - сколько файлов дали формат (это и есть «сколько форматов»);
 *   unknown - неопознанные окончания, чтобы дописать словарь.
 */
export function formatsFromFiles(files) {
  const labels = [], unknown = [];
  let count = 0;
  for (const f of files || []) {
    const r = formatFromFilename(typeof f === 'string' ? f : (f && f.name));
    if (!r) continue;
    if (r.label) {
      count++;
      if (!labels.includes(r.label)) labels.push(r.label);
    } else if (r.unknown) {
      unknown.push(r.unknown);
    }
  }
  return { formats: labels, count, unknown };
}
