/*
 * cutout.mjs - вырезать предмет из главного кадра модели.
 *
 * ЗАЧЕМ. Игре «Seek & Find» нужны предметы без фона, чтобы раскладывать их
 * в одну сцену. Новых рендеров не делаем: у главных кадров TurboSquid почти
 * всегда однотонный светлый студийный фон, и предмет отделяется от него
 * без нейросетей.
 *
 * КАК.
 *   1. Цвет фона берём по строкам с краёв кадра: у студийного задника
 *      вертикальный градиент.
 *   2. «Отличие от фона» = насколько пиксель ТЕМНЕЕ фона + отличие оттенка.
 *      Светлее фона и без цвета - тоже фон: центр задника светлее краёв,
 *      иначе вокруг предмета остаётся белый ореол.
 *   3. Фон - связная от краёв область с малым отличием (заливка).
 *   4. Мягкий край по величине отличия; цвет края отделяем от фона
 *      (pixel - (1-a)*bg) / a, поэтому серая тень становится тёмной
 *      полупрозрачной, а не светлым пятном.
 *   5. Мелкие отдельные куски (знак студии в правом нижнем углу, соринки)
 *      убираем: остаются куски не меньше 3% самого крупного.
 *
 * quality - для отбора: edgeTouch > 0 значит предмет обрезан кадром или фон
 * не однотонный; parts > 1 - в кадре несколько предметов (набор).
 */
import sharp from 'sharp';

export async function cutout(file, maxSide = 360) {
  const meta = await sharp(file).metadata();
  const W = 960, H = Math.round(W * meta.height / meta.width);
  const { data } = await sharp(file).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = W * H;

  const rowBg = new Float32Array(H * 3);
  for (let y = 0; y < H; y++) {
    const s = [0, 1, 2, W - 3, W - 2, W - 1].map(x => y * W + x);
    for (let c = 0; c < 3; c++) rowBg[y * 3 + c] = s.map(i => data[i * 3 + c]).sort((a, b) => a - b)[3];
  }

  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = (i / W) | 0;
    const p0 = data[i * 3], p1 = data[i * 3 + 1], p2 = data[i * 3 + 2];
    const b0 = rowBg[y * 3], b1 = rowBg[y * 3 + 1], b2 = rowBg[y * 3 + 2];
    const pm = (p0 + p1 + p2) / 3, bm = (b0 + b1 + b2) / 3;
    const chroma = Math.max(Math.abs(p0 - pm - (b0 - bm)), Math.abs(p1 - pm - (b1 - bm)), Math.abs(p2 - pm - (b2 - bm)));
    dist[i] = Math.max(bm - pm, 0) + chroma * 1.5;
  }
  // знак студии в правом нижнем углу кадра
  for (let y = Math.floor(H * 0.86); y < H; y++) for (let x = Math.floor(W * 0.92); x < W; x++) dist[y * W + x] = 0;

  const T = 14;
  const bg = new Uint8Array(N);
  const st = [];
  const push = i => { if (!bg[i] && dist[i] < T) { bg[i] = 1; st.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (st.length) {
    const i = st.pop(), x = i % W;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W); if (i < N - W) push(i + W);
  }

  const alpha = new Uint8Array(N);
  for (let i = 0; i < N; i++) alpha[i] = bg[i] ? 0 : Math.max(0, Math.min(255, Math.round(255 * (dist[i] - 6) / 40)));

  const lab = new Int32Array(N).fill(-1), sizes = [];
  for (let i = 0; i < N; i++) {
    if (alpha[i] <= 40 || lab[i] >= 0) continue;
    const id = sizes.length, q = [i];
    lab[i] = id;
    let n = 0;
    while (q.length) {
      const j = q.pop(); n++;
      const x = j % W;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) {
        if (k < 0 || k >= N || lab[k] >= 0 || alpha[k] <= 40) continue;
        lab[k] = id; q.push(k);
      }
    }
    sizes.push(n);
  }
  const big = Math.max(0, ...sizes);
  let x0 = W, x1 = 0, y0 = H, y1 = 0, fg = 0, edgeTouch = 0;
  for (let i = 0; i < N; i++) {
    if (alpha[i] <= 40 || sizes[lab[i]] < big * 0.03) alpha[i] = 0;
    if (alpha[i] > 128) {
      fg++;
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x < 3 || y < 3 || x > W - 4 || y > H - 4) edgeTouch++;
    }
  }
  if (x1 <= x0) return null;
  const parts = sizes.filter(s => s >= big * 0.03).length;
  const quality = { fgFrac: +(fg / N).toFixed(3), fill: +(fg / ((x1 - x0 + 1) * (y1 - y0 + 1))).toFixed(3), edgeTouch, parts };

  const rgba = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const a = alpha[i] / 255, y = (i / W) | 0;
    for (let c = 0; c < 3; c++) {
      const p = data[i * 3 + c];
      rgba[i * 4 + c] = a > 0 && a < 1 ? Math.max(0, Math.min(255, Math.round((p - (1 - a) * rowBg[y * 3 + c]) / a))) : p;
    }
    rgba[i * 4 + 3] = alpha[i];
  }
  const pad = 4;
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const cw = Math.min(W, x1 + pad + 1) - left, ch = Math.min(H, y1 + pad + 1) - top;
  const k = Math.min(1, maxSide / Math.max(cw, ch));
  const w = Math.round(cw * k), h = Math.round(ch * k);
  const buf = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left, top, width: cw, height: ch })
    .resize(w, h)
    .webp({ quality: 82, alphaQuality: 90 }).toBuffer();
  return { buf, w, h, quality };
}
