/**
 * Pure, server-side image measurements for the demo provider.
 *
 * Decodes PNG/JPEG buffers (no external AI service) and computes brightness,
 * contrast, edge density, and busyness estimates used by the heuristic provider.
 */

import { PNG } from "pngjs";
import * as jpeg from "jpeg-js";

export interface DemoImageMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  fileSizeBytes: number;
  brightnessMean: number;
  brightnessStd: number;
  darkPixelRatio: number;
  brightPixelRatio: number;
  edgeDensity: number;
  busynessScore: number;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/s);
  if (!match) {
    throw new Error("The screenshot is not a valid base64 data URL.");
  }
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

async function decodeImage(
  buffer: Buffer,
  mime: string,
): Promise<{ width: number; height: number; data: Uint8Array }> {
  if (mime === "png" || mime === "image/png") {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (mime === "jpeg" || mime === "jpg" || mime === "image/jpeg" || mime === "image/jpg") {
    const decoded = jpeg.decode(buffer, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  throw new Error(`Demo provider does not support image format "${mime}".`);
}

function sampleGray(
  data: Uint8Array,
  srcW: number,
  srcH: number,
  sampleW: number,
  sampleH: number,
): Float32Array {
  const gray = new Float32Array(sampleW * sampleH);
  for (let y = 0; y < sampleH; y++) {
    const srcY = Math.min(srcH - 1, Math.round((y / sampleH) * srcH));
    for (let x = 0; x < sampleW; x++) {
      const srcX = Math.min(srcW - 1, Math.round((x / sampleW) * srcW));
      const idx = (srcY * srcW + srcX) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      gray[y * sampleW + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return gray;
}

function computeEdgeDensity(gray: Float32Array, w: number, h: number): number {
  let edges = 0;
  const threshold = 30;
  const total = Math.max(1, (w - 2) * (h - 2));
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[(y - 1) * w + (x - 1)] -
        2 * gray[y * w + (x - 1)] -
        gray[(y + 1) * w + (x - 1)] +
        gray[(y - 1) * w + (x + 1)] +
        2 * gray[y * w + (x + 1)] +
        gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] -
        2 * gray[(y - 1) * w + x] -
        gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] +
        2 * gray[(y + 1) * w + x] +
        gray[(y + 1) * w + (x + 1)];
      if (Math.sqrt(gx * gx + gy * gy) > threshold) {
        edges++;
      }
    }
  }
  return edges / total;
}

export async function measureImage(dataUrl: string): Promise<DemoImageMetrics> {
  const { mime, buffer } = parseDataUrl(dataUrl);
  const { width, height, data } = await decodeImage(buffer, mime);

  const sampleW = Math.min(width, 256);
  const sampleH = Math.max(1, Math.round(height * (sampleW / width)));
  const gray = sampleGray(data, width, height, sampleW, sampleH);

  const total = gray.length;
  const mean = gray.reduce((a, b) => a + b, 0) / total;
  const variance = gray.reduce((a, b) => a + (b - mean) * (b - mean), 0) / total;
  const std = Math.sqrt(variance);

  let dark = 0;
  let bright = 0;
  for (let i = 0; i < total; i++) {
    if (gray[i] < 50) dark++;
    else if (gray[i] > 200) bright++;
  }

  return {
    width,
    height,
    aspectRatio: width / Math.max(1, height),
    fileSizeBytes: buffer.length,
    brightnessMean: mean,
    brightnessStd: std,
    darkPixelRatio: dark / total,
    brightPixelRatio: bright / total,
    edgeDensity: computeEdgeDensity(gray, sampleW, sampleH),
    busynessScore: Math.min(100, Math.round(computeEdgeDensity(gray, sampleW, sampleH) * 300)),
  };
}
