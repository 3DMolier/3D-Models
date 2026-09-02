/*
 * html-entities.mjs - вернуть тексту, снятому со страницы, обычный вид.
 *
 * ЗАЧЕМ. Запись хранит ДАННЫЕ, а разметку рисует генератор: он сам экранирует
 * всё, что печатает. Если в запись положить уже экранированный текст, снятый со
 * страницы, экранирование ляжет вторым слоем.
 *
 * Это не мелочь. Подписанные адреса снимков студии выглядят так:
 *   ...&amp;X-Amz-Credential=...&amp;X-Amz-Signature=...
 * Экранируй их ещё раз - выйдет «&amp;amp;», браузер попросит параметр с именем
 * «amp;X-Amz-Credential», подпись не сойдётся, и картинка отдаст 403. Молча:
 * разметка останется валидной, сломается только картинка. Так пострадали бы
 * 220 главных снимков и 2 664 снимка галерей.
 *
 * И обратный случай: шесть живых заголовков УЖЕ экранированы дважды, посетитель
 * видит «Lady&#x27;s Bag» вместо «Lady's Bag». Поэтому раскодируем не один раз,
 * а пока строка меняется - и заодно чиним старую опечатку.
 *
 * Настоящий текст «&amp;» в названии модели или в подписанном адресе не
 * встречается, так что повторное раскодирование ничего не портит.
 */

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'",
  ldquo: '"', rdquo: '"', deg: '°', times: '×', middot: '·',
};

/** Один проход: заменить все сущности, какие узнали. */
function pass(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]{1,10});/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 32 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch (e) { return whole; }
    }
    const v = NAMED[body.toLowerCase()];
    return v === undefined ? whole : v;
  });
}

/** Раскодировать до упора: пока строка меняется, но не больше пяти кругов. */
export function decodeEntities(input) {
  let s = String(input == null ? '' : input);
  for (let i = 0; i < 5; i++) {
    const next = pass(s);
    if (next === s) break;
    s = next;
  }
  return s;
}

export default decodeEntities;
