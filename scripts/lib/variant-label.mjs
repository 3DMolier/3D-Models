/*
 * variant-label.mjs - подпись варианта модели.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Правила подписи живут внутри merge-variants.mjs, и
 * пока карточку рисует он же, это терпимо. Но галерею на карточке теперь
 * собирает генератор из записи, и ему нужны те же подписи. Скопировать правила
 * значило бы завести второй экземпляр - ровно ту беду, от которой мы уходим:
 * подписи разошлись бы при первой же правке в одном из мест.
 *
 * ЧТО ЭТО. Из названия варианта вынимается ОТЛИЧИЕ от базовой модели: цвет,
 * программа, оснастка, упрощение. «Atlantic Salmon Fish Rigged» -> «Rigged»,
 * «… Rigged For Maya» -> «Maya · Rigged». Если отличий нет - «Standard».
 *
 * ОСТАЛОСЬ СДЕЛАТЬ (этап 4 плана): перевести merge-variants.mjs на этот модуль,
 * чтобы правила действительно существовали в одном экземпляре. Пока он держит
 * свою копию, и расхождение возможно - здесь об этом сказано вслух, а не
 * оставлено на память.
 */

// Регулярки берём из общего модуля: своя копия была уже третьей по счёту.
import { SOFT, COLOR_ANY } from './model-name.mjs';
const hasRig = n => /\b(rigged|rigid)\b/i.test(n);
const hasAnim = n => /\banimated\b/i.test(n);
const caps = s => String(s).replace(/\b\w/g, c => c.toUpperCase());

/** Все отличия варианта одним списком. */
function bitsOf(name) {
  const bits = [];
  // Цветов в названии бывает несколько: у фески свой цвет у шапки и свой у
  // кисточки. Берём ВСЕ - иначе двенадцать вариантов получают подписи «Black»
  // и «Black (2)», по которым ничего не выбрать.
  const cs = [...new Set((String(name).match(COLOR_ANY) || []).map(c => c.toLowerCase()))];
  if (cs.length) bits.push(cs.map(caps).join(' + '));
  const sm = String(name).match(SOFT);
  if (sm) bits.push(caps(sm[1].replace(/\s+/g, ' ')));
  if (hasRig(name)) bits.push('Rigged');
  if (/\blow\s*poly\b/i.test(name)) bits.push('Low Poly');
  if (/\bsimplified\b/i.test(name)) bits.push('Simplified');
  if (/\bsimple\s+interior\b/i.test(name)) bits.push('Simple Interior');
  if (hasAnim(name)) bits.push('Animated');
  // Поза - тоже отличие варианта, и на карточке лосося она подписана именно так.
  // Без неё «Atlantic Salmon Fish Swimming Pose» получал подпись «Standard»,
  // одинаковую с базовой моделью, и выбрать по ней было нечего.
  // «Swiming» с одной m - опечатка в названиях у самой студии, встречается.
  const pm = String(name).match(/\b(swim+ing|floating|flying|walking|running|sitting|standing|idle|jumping|attack|resting)\s+pose\b/i);
  if (pm) bits.push(caps(pm[0].toLowerCase().replace(/swiming/, 'swimming')));
  return bits;
}

/** Полная подпись варианта: «Maya · Rigged». */
export function variantLabel(name) {
  const bits = bitsOf(name);
  return bits.length ? bits.join(' · ') : 'Standard';
}

/**
 * Короткая подпись под миниатюрой. В плитку 108 пикселей полная метка не
 * влезает, а без подписи по одинаковым машинам разного цвета не понять, где что.
 */
export function variantShortLabel(name) {
  const bits = bitsOf(name);
  if (!bits.length) return 'Standard';
  // Цвет важнее программы: по нему выбирают глазами.
  return bits[0].replace(/ \+ /g, '+');
}
