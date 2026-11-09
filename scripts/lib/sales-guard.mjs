/*
 * sales-guard.mjs - найти в тексте число продаж (решение основателя 09.11.2026:
 * «не публиковать количество продаж в общий доступ»).
 *
 * Ловит и цифрой, и словом: «41 buyers», «fifty copies have been bought»,
 * «sold 228 times», «has sold», «found 41 buyers», а также «best-selling» и
 * «most bought». Пропускает «It is sold through TurboSquid» и «on sale since 2018» -
 * там нет счёта. Ложные срабатывания есть: «a dozen copies» в смысле экземпляров
 * в сцене, «has sold in enormous numbers» про настоящий предмет. Для новых текстов
 * это приемлемо - автор просто перепишет фразу (copies -> instances).
 *
 * Пользуются: night-apply.mjs (отказ в приёмке), night-sales-fix.mjs (очередь
 * переписывания уже опубликованных текстов), night-brief.mjs --rewrite (подсказка).
 */
export const NUMW = String.raw`(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozens?)`;
export const SALES_RE = [
  new RegExp(String.raw`\b${NUMW}(?:[- ][a-z]+){0,3}\s+(?:buyers|copies|sales|purchases|customers|downloads|orders)\b`, 'i'),
  new RegExp(String.raw`\b(?:sold|bought|purchased|downloaded)\s+(?:[a-z]+\s+){0,2}${NUMW}\s+times\b`, 'i'),
  new RegExp(String.raw`\b${NUMW}\s+times\b[^.]*\b(?:sold|bought|purchased)\b`, 'i'),
  new RegExp(String.raw`\b(?:has|have|had)\s+(?:been\s+)?(?:sold|bought)\b`, 'i'),
  new RegExp(String.raw`\b(?:found|gone home with|went home with)\s+${NUMW}\b`, 'i'),
  /\b(?:best[- ]?sell(?:er|ing)|most[- ](?:bought|purchased))\b/i,
];
const sentences = t => String(t).split(/(?<=[.!?])\s+/);
export const hasSales = s => SALES_RE.some(re => re.test(s));
/* Все предложения с продажами из текста (строки или массива абзацев). */
export const salesSentences = text => [].concat(text).flatMap(sentences).filter(hasSales).map(s => s.trim());
/* Для приёмки: пустой массив - продаж нет, иначе одна строка с первым найденным. */
export function checkSales(paragraphs) {
  const s = salesSentences(paragraphs)[0];
  return s ? ['продажи в тексте (нельзя с 09.11.2026): «' + s.slice(0, 90) + '»'] : [];
}
