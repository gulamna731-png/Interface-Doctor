/** Browser-only helpers: files → previews, sample conversion, thumbnails. */

import type { ScreenshotSelection } from "@/lib/types";

const DEFAULT_MAX_ANALYSIS_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

/**
 * Downscale a data-URL image so it is small enough for reliable network upload
 * and Ollama token processing while keeping text and UI details readable.
 * Screenshots are converted to JPEG unless the source is PNG with transparency.
 */
export async function downscaleDataUrl(
  dataUrl: string,
  mimeType: string,
  maxDimension = DEFAULT_MAX_ANALYSIS_DIMENSION,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image for resizing."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / img.naturalWidth, maxDimension / img.naturalHeight);
  if (scale >= 1) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const outputMime = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const quality = outputMime === "image/jpeg" ? JPEG_QUALITY : undefined;
  return canvas.toDataURL(outputMime, quality);
}

/** Read an image file into a ScreenshotSelection with a preview + data URL. */
export async function fileToSelection(
  file: File,
  maxDimension = DEFAULT_MAX_ANALYSIS_DIMENSION,
): Promise<ScreenshotSelection> {
  const readerResult = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () =>
      reject(new Error("The file could not be decoded as an image. It may be corrupted."));
    el.src = readerResult;
  });

  const mimeType = file.type || "image/png";
  const dataUrl = await downscaleDataUrl(readerResult, mimeType, maxDimension);

  return {
    previewUrl: dataUrl,
    dataUrl,
    name: file.name,
    sizeBytes: Math.round((dataUrl.length * 3) / 4),
    mimeType,
    width: img.naturalWidth,
    height: img.naturalHeight,
    source: "upload",
  };
}

/**
 * Load the bundled sample screenshot (SVG) and rasterize it to a real PNG so
 * it passes through the exact same pipeline (and server validation) as an
 * uploaded file.
 */
export async function loadSampleSelection(
  maxDimension = DEFAULT_MAX_ANALYSIS_DIMENSION,
): Promise<ScreenshotSelection> {
  const res = await fetch("/sample-screenshot.svg");
  if (!res.ok) throw new Error("The sample screenshot could not be loaded.");
  const svgText = await res.text();

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("The sample screenshot could not be decoded."));
    el.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1200;
  canvas.height = img.naturalHeight || 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("The sample screenshot could not be converted to PNG.");

  const fullDataUrl = canvas.toDataURL("image/png");
  const dataUrl = await downscaleDataUrl(fullDataUrl, "image/png", maxDimension);
  return {
    previewUrl: dataUrl,
    dataUrl,
    name: "sample-screenshot.png",
    sizeBytes: Math.round((dataUrl.length * 3) / 4),
    mimeType: "image/png",
    width: canvas.width,
    height: canvas.height,
    source: "sample",
  };
}

/** Downscale a screenshot to a small thumbnail data URL for recent projects. */
export async function makeThumbnail(dataUrl: string, maxWidth = 320): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Thumbnail generation failed."));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
