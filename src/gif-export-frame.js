/**
 * Shared GIF frame pipeline: subtle noise, PNN quantize (perceptual), Floyd–Steinberg to indices.
 */
import { quantize } from '../assets/vendor/gifenc.esm.js';

/** ~1.5% equivalent RGB jitter to break banding before palette selection */
const DEFAULT_NOISE_STRENGTH = 0.015;

function clampByte(v) {
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

export function findTransparentPaletteIndex(palette) {
  for (let i = 0; i < palette.length; i++) {
    const entry = palette[i];
    if (entry.length >= 4 && entry[3] === 0) return i;
  }
  return -1;
}

export function applySubtleRgbNoise(rgba, strength = DEFAULT_NOISE_STRENGTH) {
  const span = strength * 255 * 2;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    rgba[i] = clampByte(rgba[i] + (Math.random() - 0.5) * span);
    rgba[i + 1] = clampByte(rgba[i + 1] + (Math.random() - 0.5) * span);
    rgba[i + 2] = clampByte(rgba[i + 2] + (Math.random() - 0.5) * span);
  }
}

function buildOpaquePaletteIndices(palette, transparentIndex) {
  const ids = [];
  for (let i = 0; i < palette.length; i++) {
    if (i === transparentIndex) continue;
    const e = palette[i];
    if (e.length >= 4 && e[3] === 0) continue;
    ids.push(i);
  }
  return ids.length ? ids : palette.map((_, i) => i);
}

/** Rec. 709 weighted squared distance (perceptual-ish, fast) */
function paletteDistanceSq(r, g, b, pe) {
  const pr = pe[0];
  const pg = pe[1];
  const pb = pe[2];
  const dr = r - pr;
  const dg = g - pg;
  const db = b - pb;
  return 0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db;
}

function nearestPaletteIndex(r, g, b, palette, opaqueIds) {
  let best = opaqueIds[0];
  let bestD = Infinity;
  for (let k = 0; k < opaqueIds.length; k++) {
    const idx = opaqueIds[k];
    const d = paletteDistanceSq(r, g, b, palette[idx]);
    if (d < bestD) {
      bestD = d;
      best = idx;
    }
  }
  return best;
}

/**
 * @param {Uint8ClampedArray} rgba - mutable copy of frame pixels
 * @param {number} width
 * @param {number} height
 * @param {Array} palette - from gifenc quantize (rgba4444 entries)
 * @param {number} transparentIndex - palette index for transparent pixels, or -1
 * @returns {Uint8Array} indexed pixels for GIFEncoder.writeFrame
 */
export function floydSteinbergDitherToIndexed(rgba, width, height, palette, transparentIndex) {
  const n = width * height;
  const out = new Uint8Array(n);
  const rf = new Float32Array(n);
  const gf = new Float32Array(n);
  const bf = new Float32Array(n);
  const af = new Uint8Array(n);

  for (let i = 0, p = 0; p < n; i += 4, p++) {
    rf[p] = rgba[i];
    gf[p] = rgba[i + 1];
    bf[p] = rgba[i + 2];
    af[p] = rgba[i + 3];
  }

  const opaqueIds = buildOpaquePaletteIndices(palette, transparentIndex);
  const useTransparent = transparentIndex >= 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;

      if (useTransparent && af[p] < 128) {
        out[p] = transparentIndex;
        continue;
      }

      let r = rf[p];
      let g = gf[p];
      let b = bf[p];
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;

      const idx = nearestPaletteIndex(r, g, b, palette, opaqueIds);
      const pe = palette[idx];
      const nr = pe[0];
      const ng = pe[1];
      const nb = pe[2];

      out[p] = idx;

      const er = r - nr;
      const eg = g - ng;
      const eb = b - nb;

      const diffuse = (qp, f) => {
        if (qp < 0 || qp >= n) return;
        if (useTransparent && af[qp] < 128) return;
        rf[qp] += er * f;
        gf[qp] += eg * f;
        bf[qp] += eb * f;
      };

      if (x + 1 < width) diffuse(p + 1, 7 / 16);
      if (y + 1 < height) {
        if (x > 0) diffuse(p + width - 1, 3 / 16);
        diffuse(p + width, 5 / 16);
        if (x + 1 < width) diffuse(p + width + 1, 1 / 16);
      }
    }
  }

  return out;
}

/**
 * Full per-frame processing: noise → quantize (256, PNN + sqrt) → Floyd–Steinberg indices.
 * @param {Uint8ClampedArray} pixelData - copy of ImageData; may be mutated
 * @param {number} width
 * @param {number} height
 * @param {object} quantizeOpts - passed to gifenc quantize (format rgba4444, etc.)
 */
export function processGifFramePixels(pixelData, width, height, quantizeOpts) {
  applySubtleRgbNoise(pixelData, DEFAULT_NOISE_STRENGTH);
  const palette = quantize(pixelData, 256, {
    ...quantizeOpts,
    useSqrt: true
  });
  const transparentIndex = findTransparentPaletteIndex(palette);
  const index = floydSteinbergDitherToIndexed(pixelData, width, height, palette, transparentIndex);
  return { index, palette, transparentIndex };
}
