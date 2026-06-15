import { GEN_PALETTE } from "./constants.js";
import { rng } from "./random.js";

// Procedurally draw a unique little pixel creature -> PNG data URL.
export function genCreature(seed) {
  const rnd = rng(seed);
  const N = 32;
  const cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const body = GEN_PALETTE[Math.floor(rnd() * GEN_PALETTE.length)];
  const dark = "#4A4038";
  const cx = 16;
  const hw = 4 + Math.floor(rnd() * 3);
  const y0 = 8 + Math.floor(rnd() * 2);
  const y1 = 20 + Math.floor(rnd() * 4);
  const hRows = y1 - y0;
  const px = (x, y, c) => {
    if (x < 0 || x > 31 || y < 0 || y > 31) return;
    ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
  };
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / hRows;
    const w = Math.round(hw * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))));
    for (let x = cx - w; x <= cx + w; x++) px(x, y, body);
  }
  if (rnd() < 0.5) {
    const eo = Math.max(2, hw - 1);
    for (let k = 0; k < 2; k++) {
      px(cx - eo, y0 - 1 - k, body); px(cx - eo + 1, y0 - 1 - k, body);
      px(cx + eo - 1, y0 - 1 - k, body); px(cx + eo, y0 - 1 - k, body);
    }
  }
  if (rnd() < 0.6) {
    px(cx - 3, y1 + 1, body); px(cx - 2, y1 + 1, body);
    px(cx + 2, y1 + 1, body); px(cx + 3, y1 + 1, body);
  }
  const eo = 2 + Math.floor(rnd() * 2);
  const ey = y0 + Math.floor(hRows * 0.45);
  px(cx - eo, ey, dark); px(cx + eo, ey, dark);
  if (rnd() < 0.5) {
    ctx.fillStyle = "rgba(217,140,134,.5)";
    ctx.fillRect(cx - eo - 2, ey + 1, 1, 1);
    ctx.fillRect(cx + eo + 1, ey + 1, 1, 1);
  }
  const my = ey + 2;
  px(cx, my, dark);
  if (rnd() < 0.45) { px(cx - 1, my, dark); px(cx + 1, my, dark); }
  return cv.toDataURL("image/png");
}
