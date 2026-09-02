/*
 * catch-batch.mjs - одноразовый приёмник данных из вкладки браузера.
 *
 * ЗАЧЕМ. Сбор идёт в авторизованной вкладке студии, а результат нужен на диске.
 * Гонять 700 КБ через переписку - дорого и бессмысленно: данные всё равно
 * уходят в файл. Скрипт поднимает местный приёмник, страница отправляет ему
 * собранное одним запросом, файл ложится на диск, приёмник закрывается.
 *
 * БЕЗОПАСНОСТЬ. Слушает только 127.0.0.1, принимает РОВНО один запрос и сразу
 * завершается. Ничего никуда не отправляет. Живёт меньше минуты.
 *
 * Запуск:  node scripts/catch-batch.mjs .tmp/xl/studio-batch.json
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) { console.log('нужен путь к файлу'); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('только POST'); return; }

  const parts = [];
  req.on('data', c => parts.push(c));
  req.on('end', () => {
    const body = Buffer.concat(parts).toString('utf8');
    try {
      JSON.parse(body); // не пишем то, что не разбирается
    } catch (e) {
      res.writeHead(400); res.end('негодный JSON');
      console.log('ОТКАЗ: тело не разбирается как JSON');
      server.close(); process.exit(1);
    }
    fs.writeFileSync(OUT, body);
    res.writeHead(200); res.end('ok');
    console.log('принято ' + body.length.toLocaleString('ru-RU') + ' байт -> ' + OUT);
    server.close(() => process.exit(0));
  });
});

server.listen(8765, '127.0.0.1', () => console.log('жду один запрос на http://127.0.0.1:8765 ...'));
// Не висим вечно, если отправки не будет.
setTimeout(() => { console.log('ничего не пришло за 3 минуты'); process.exit(2); }, 180000);
