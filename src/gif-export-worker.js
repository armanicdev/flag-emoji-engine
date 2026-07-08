/**
 * Off-main-thread GIF frame quantization + dithering (imports shared pipeline).
 */
import { processGifFramePixels } from './gif-export-frame.js';

self.onmessage = (e) => {
  const { buffer, width, height, quantizeOpts } = e.data;
  try {
    const data = new Uint8ClampedArray(buffer);
    const { index, palette, transparentIndex } = processGifFramePixels(data, width, height, quantizeOpts);
    self.postMessage({ ok: true, index, palette, transparentIndex }, [index.buffer]);
  } catch (err) {
    self.postMessage({ ok: false, error: String(err?.message || err) });
  }
};
