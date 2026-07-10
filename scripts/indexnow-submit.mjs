// IndexNow submit - мгновенно уведомляет Bing/Yandex о новых/изменённых страницах.
// ВАЖНО: Google IndexNow НЕ поддерживает - для Google остаётся sitemap + Request Indexing в GSC.
// Ключ опубликован по адресу https://3dmolierstudio.com/<key>.txt (валидация владения).
//
// Использование:
//   node scripts/indexnow-submit.mjs https://3dmolierstudio.com/data-licensing/ https://3dmolierstudio.com/...
//   node scripts/indexnow-submit.mjs --file urls.txt      (по одному URL на строку)
// Лимит IndexNow - до 10 000 URL за запрос. Не спамить одними и теми же URL ежедневно.

import https from 'node:https';
import { readFileSync } from 'node:fs';

const HOST = '3dmolierstudio.com';
const KEY = 'd59c7448359d5ad74e71ecac5ddb0d72';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const args = process.argv.slice(2);
let urls = [];
const fileIdx = args.indexOf('--file');
if (fileIdx !== -1 && args[fileIdx + 1]) {
  urls = readFileSync(args[fileIdx + 1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
} else {
  urls = args.filter(a => a.startsWith('http'));
}

if (urls.length === 0) {
  console.error('Нет URL. Пример: node scripts/indexnow-submit.mjs https://3dmolierstudio.com/data-licensing/');
  process.exit(1);
}
const bad = urls.filter(u => !u.startsWith(`https://${HOST}/`));
if (bad.length) {
  console.error('Есть URL не с этого домена (IndexNow их отклонит):', bad.slice(0, 5));
  process.exit(1);
}

const payload = JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls });
const req = https.request({
  hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) },
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    // 200/202 = принято. 422 = URL не совпал с host/ключом. 403 = ключ не найден по keyLocation.
    console.log(`IndexNow ответ: ${res.statusCode}. URL отправлено: ${urls.length}.`, body ? `Тело: ${body}` : '');
  });
});
req.on('error', e => { console.error('Ошибка отправки IndexNow:', e.message); process.exit(1); });
req.write(payload);
req.end();
