import { ROOT } from './lib/paths.mjs';
// classify15.mjs — классификатор всех 86k моделей в 15 категорий сайта (+ other).
// Матч по ЦЕЛЫМ токенам имени (не подстроке), порядок = приоритет.
// Режимы:  --stats  (распределение + примеры)  |  --dump <cat>  (все имена категории)
import fs from 'node:fs';
import path from 'node:path';
const DATA = ROOT + '/data';

// Список переехал в lib/cat-keywords.mjs: им пользуются ещё три скрипта,
// и они вырезали его отсюда из ТЕКСТА файла через eval.
import { CATS } from './lib/cat-keywords.mjs';
const dispOf = Object.fromEntries(CATS.map(c=>[c[0],c[1]]));

function classify(name){
  const t = new Set(name.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const [slug,disp,kws] of CATS){ if (kws.find(k=>t.has(k))) return slug; }
  return 'other';
}

function loadAll(){
  const files = fs.readdirSync(DATA).filter(f=>/^fc-chunk-\d+\.json$/.test(f)).sort((a,b)=>+a.match(/\d+/)[0]-+b.match(/\d+/)[0]);
  const all=[];
  for (const f of files){ const d=JSON.parse(fs.readFileSync(path.join(DATA,f))); for(let j=0;j<d.i.length;j++) all.push({id:d.i[j],name:d.n[j],price:d.p[j]}); }
  return all;
}

const all = loadAll();
const args = process.argv.slice(2);
const buckets={};
for (const m of all){ const c=classify(m.name); (buckets[c]=buckets[c]||[]).push(m); }

if (args.includes('--dump')){
  const cat = args[args.indexOf('--dump')+1];
  for (const m of (buckets[cat]||[])) console.log(m.name);
  process.exit(0);
}
// --stats (по умолчанию)
console.log('Всего моделей:', all.length, '\n');
const order = CATS.map(c=>c[0]).concat('other');
for (const c of order){
  const arr = buckets[c]||[];
  const disp = dispOf[c] || 'Other';
  console.log(`${disp.padEnd(24)} ${String(arr.length).padStart(6)}  |  ` + arr.slice(0,5).map(m=>m.name.slice(0,32)).join(' · '));
}
const otherPct = ((buckets['other']||[]).length/all.length*100).toFixed(1);
console.log(`\n"other" = ${otherPct}% (чем меньше, тем лучше классификатор)`);
