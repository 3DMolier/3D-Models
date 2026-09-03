/*
 * catch-batch.mjs - одноразовый приёмник данных из вкладки браузера.
 *
 * ЗАЧЕМ. Сбор идёт в авторизованной вкладке студии, а результат нужен на диске.
 * Гонять 700 КБ через переписку - дорого и бессмысленно: данные всё равно
 * уходят в файл. Скрипт поднимает местный приёмник, страница отправляет ему
 * собранное одним запросом, файл ложится на диск, приёмник закрывается.
 *
 * БЕЗОПАСНОСТЬ. Слушает только 127.0.0.1, ничего никуда не отправляет и сам
 * закрывается, когда принял всё или вышло время.
 *
 * ЧАСТЯМИ. Первая попытка отправляла 700 КБ одним запросом, и вкладка не успела
 * ответить за отведённые ей 45 секунд. Поэтому принимаем несколько частей и
 * склеиваем: сколько ждать, говорится числом при запуске.
 *
 * НЕ РАБОТАЕТ СО СТРАНИЦЫ ПО HTTPS. Проверено 02.09.2026: страница студии
 * открыта по https, приёмник живёт на 127.0.0.1, и Chrome считает это
 * обращением во внутреннюю сеть. Запрос молча висит - ни ответа, ни ошибки.
 * Заголовок Access-Control-Allow-Private-Network не помогает: в свежих версиях
 * такое обращение требует РАЗРЕШЕНИЯ ПОЛЬЗОВАТЕЛЯ, а его некому дать, когда
 * вкладкой правит автоматика. С этой же машины через Node приёмник отвечает 200
 * - значит дело именно в браузере.
 *
 * Годится, когда отправляющая страница сама открыта по http (например с
 * местного сервера сайта). Для страниц по https нужен другой путь: выгрузка
 * файлом, которую запускает сам основатель.
 *
 * Запуск:  node scripts/catch-batch.mjs .tmp/xl/studio-batch.json 8
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const OUT = process.argv[2];
const WANT = Number(process.argv[3]) || 1;
if (!OUT) { console.log('нужен путь к файлу'); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const got = [];
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  /*
   * Страница открыта по https, а приёмник живёт на 127.0.0.1. Браузер считает
   * такой переход обращением во внутреннюю сеть и без этого заголовка молча
   * держит запрос: ни ответа, ни ошибки - именно так первая попытка и зависла.
   */
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('только POST'); return; }

  const parts = [];
  req.on('data', c => parts.push(c));
  req.on('end', () => {
    const body = Buffer.concat(parts).toString('utf8');
    let obj;
    try {
      obj = JSON.parse(body); // не пишем то, что не разбирается
    } catch (e) {
      res.writeHead(400); res.end('негодный JSON');
      console.log('ОТКАЗ: часть не разбирается как JSON');
      server.close(); process.exit(1);
    }
    got.push(obj);
    res.writeHead(200); res.end('ok');
    console.log('часть ' + got.length + ' из ' + WANT + ': '
      + body.length.toLocaleString('ru-RU') + ' байт, ключей '
      + Object.keys(obj).length);
    if (got.length < WANT) return;

    // Склеиваем части в один объект и пишем.
    const all = Object.assign({}, ...got);
    fs.writeFileSync(OUT, JSON.stringify(all));
    console.log('записано ' + Object.keys(all).length.toLocaleString('ru-RU')
      + ' моделей -> ' + OUT);
    server.close(() => process.exit(0));
  });
});

server.listen(8765, '127.0.0.1', () => console.log('жду ' + WANT + ' частей на http://127.0.0.1:8765 ...'));
// Не висим вечно, если отправки не будет.
setTimeout(() => {
  if (!got.length) { console.log('ничего не пришло за 8 минут'); process.exit(2); }
  const all = Object.assign({}, ...got);
  fs.writeFileSync(OUT, JSON.stringify(all));
  console.log('время вышло, записано частей ' + got.length + ' из ' + WANT
    + ', моделей ' + Object.keys(all).length);
  process.exit(3);
}, 480000);
