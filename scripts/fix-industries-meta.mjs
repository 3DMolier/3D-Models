/*
 * fix-industries-meta.mjs - укорачивает title и description на страницах отраслей.
 *
 * Зачем. Одиннадцать из двенадцати страниц имели title до 80 символов и
 * description до 195. Поиск обрезает такие строки на середине слова, и вместо
 * законченной мысли посетитель видит обрывок с многоточием. Рамки: title до 65,
 * description 120-158.
 *
 * Тексты переписаны вручную, а не обрезаны автоматически: обрезка по длине
 * рвёт перечисление и теряет как раз то слово, ради которого страницу открыли.
 * Смысл и ключевые слова сохранены, выброшены повторы и общие места.
 *
 * og:title и og:description держим в согласии с title и description - на этих
 * страницах они дублируют друг друга, и расхождение выглядело бы небрежностью.
 *
 * Запуск:  node scripts/fix-industries-meta.mjs --dry
 *          node scripts/fix-industries-meta.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const DRY = process.argv.includes('--dry');

const FIX = {
  '3d-printing': {
    t: '3D Printing Models - Prototyping & Manufacturing | 3D Molier',
    d: 'Production-ready 3D assets with clean topology and real-world scale for 3D printing, rapid prototyping and additive manufacturing workflows.',
  },
  'advertising': {
    t: 'Advertising 3D Models - Product Visualization | 3D Molier',
    d: 'High-resolution 3D models for advertising and commercial production: vehicles, products, architecture. CheckMate certified for close-up hero shots.',
  },
  'aerospace': {
    t: 'Aerospace 3D Models - Aircraft, Rockets & Space | 3D Molier',
    d: 'Professional aerospace 3D models: commercial aircraft, military jets, helicopters, rockets and satellites for engineering, simulation and film.',
  },
  'architecture': {
    t: 'Architecture 3D Models - Buildings & Landmarks | 3D Molier',
    d: 'Professional architectural 3D models: famous landmarks, commercial buildings, residential structures and interior props for architectural visualization.',
  },
  'event-management': {
    t: 'Event Management 3D Models - Venues & Stages | 3D Molier',
    d: 'Professional 3D assets for event designers, venue planners and trade show organizers. Visualize your event before the first chair is placed on the floor.',
  },
  'film-video-production': {
    t: 'Film & VFX 3D Models - Production-Ready Assets | 3D Molier',
    d: 'Production-quality 3D models for film and video: vehicles, aircraft, military, architecture and characters. CheckMate certified and proven in VFX work.',
  },
  'game-development': {
    t: 'Game-Ready 3D Models - Vehicles & Environments | 3D Molier',
    d: 'Production-ready 3D models for game development: optimized geometry, PBR textures, correct scale and multiple LODs. Vehicles, military, characters.',
  },
  'hardware': {
    t: 'Hardware 3D Models - Electronics & Devices | 3D Molier',
    d: 'Precision 3D assets for hardware startups, electronics manufacturers and industrial designers. From a single circuit board to a full product assembly.',
  },
  'medical': {
    t: 'Medical 3D Models - Anatomy, Organs & Devices | 3D Molier',
    d: '1,900+ medical and anatomical 3D models: human organs, skeletal systems, surgical equipment and devices for education and healthcare visualization.',
  },
  'military-defense': {
    t: 'Military 3D Models - Tanks, Aircraft & Weapons | 3D Molier',
    d: '1,700+ military 3D models for defense training, simulation and games: tanks, APCs, fighter jets, warships, drones, artillery and infantry equipment.',
  },
  'software-development': {
    t: 'Software Development Models - UI & Tech Visuals | 3D Molier',
    d: 'High-quality 3D models for software companies, SaaS presentations, product demos and explainer videos. Modern visuals for a digital-first audience.',
  },
};

const esc = s => s.replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;');
let ok = 0, bad = 0;

for (const [slug, v] of Object.entries(FIX)) {
  const file = path.join(ROOT, 'industries', slug, 'index.html');
  if (!fs.existsSync(file)) { console.log('  ! нет страницы: ' + slug); bad++; continue; }
  if (v.t.length > 65 || v.d.length < 120 || v.d.length > 158) {
    console.log('  ! ' + slug + ': сам текст вне рамок - title ' + v.t.length + ', desc ' + v.d.length);
    bad++; continue;
  }
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  const T = esc(v.t), D = esc(v.d);
  h = h.replace(/<title>[\s\S]*?<\/title>/, '<title>' + T + '</title>');
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + D + b);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, (m, a, b) => a + T + b);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, b) => a + D + b);
  h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, a, b) => a + T + b);
  h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, b) => a + D + b);
  if (h !== before) {
    ok++;
    console.log('  ' + slug + ': title ' + v.t.length + ', desc ' + v.d.length);
    if (!DRY) fs.writeFileSync(file, h);
  }
}
console.log('\nстраниц исправлено: ' + ok + (DRY ? '  (--dry)' : '') + (bad ? ', с ошибкой: ' + bad : ''));
