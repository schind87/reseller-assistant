import type { PhotoAspectGuide } from "@/lib/platforms";

/** Max long-edge pixels for cropped listing JPEGs (matches CameraCapture). */
export const PHOTO_ASPECT_MAX_LONG_EDGE = 1600;

/** Relative tolerance when deciding a photo already matches the platform frame. */
export const PHOTO_ASPECT_NEAR_TOLERANCE = 0.02;

export type PhotoCropTransform = {
  /** Zoom relative to cover-fit (1 = fill the frame). */
  scale: number;
  /** Pan in frame pixels (positive = image moves right/down). */
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_PHOTO_CROP_TRANSFORM: PhotoCropTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export function aspectRatio(guide: PhotoAspectGuide): number {
  return guide.width / guide.height;
}

export function isNearAspect(
  width: number,
  height: number,
  guide: PhotoAspectGuide,
  tolerance = PHOTO_ASPECT_NEAR_TOLERANCE
): boolean {
  if (width <= 0 || height <= 0) return false;
  const target = aspectRatio(guide);
  const actual = width / height;
  return Math.abs(actual - target) / target <= tolerance;
}

/** Output canvas size with the guide aspect and a capped long edge. */
export function targetSizeFromLongEdge(
  guide: PhotoAspectGuide,
  longEdge: number
): { width: number; height: number } {
  const ratio = aspectRatio(guide);
  const edge = Math.max(1, Math.round(longEdge));
  if (ratio >= 1) {
    return {
      width: edge,
      height: Math.max(1, Math.round(edge / ratio)),
    };
  }
  return {
    width: Math.max(1, Math.round(edge * ratio)),
    height: edge,
  };
}

export type ImageCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/**
 * Source rectangle (image pixels) visible inside a frame given cover-fit + pan/zoom.
 */
export function cropRectFromTransform(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  transform: PhotoCropTransform
): ImageCropRect {
  const iw = Math.max(1, imageWidth);
  const ih = Math.max(1, imageHeight);
  const fw = Math.max(1, frameWidth);
  const fh = Math.max(1, frameHeight);
  const scale = Math.max(1, transform.scale);
  const baseScale = Math.max(fw / iw, fh / ih);
  const displayScale = baseScale * scale;

  let left = (fw - iw * displayScale) / 2 + transform.offsetX;
  let top = (fh - ih * displayScale) / 2 + transform.offsetY;

  // Keep the frame covered (no empty edges inside the crop).
  const minLeft = fw - iw * displayScale;
  const minTop = fh - ih * displayScale;
  left = Math.min(0, Math.max(minLeft, left));
  top = Math.min(0, Math.max(minTop, top));

  let sx = (0 - left) / displayScale;
  let sy = (0 - top) / displayScale;
  let sw = fw / displayScale;
  let sh = fh / displayScale;

  sx = Math.min(Math.max(0, sx), Math.max(0, iw - sw));
  sy = Math.min(Math.max(0, sy), Math.max(0, ih - sh));
  sw = Math.min(sw, iw - sx);
  sh = Math.min(sh, ih - sy);

  return { sx, sy, sw, sh };
}

/** Center crop that matches `guide` using the largest possible area. */
export function centerCropRect(
  imageWidth: number,
  imageHeight: number,
  guide: PhotoAspectGuide
): ImageCropRect {
  const target = aspectRatio(guide);
  const iw = Math.max(1, imageWidth);
  const ih = Math.max(1, imageHeight);
  let sw = iw;
  let sh = iw / target;
  if (sh > ih) {
    sh = ih;
    sw = ih * target;
  }
  return {
    sx: (iw - sw) / 2,
    sy: (ih - sh) / 2,
    sw,
    sh,
  };
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load that photo."));
    img.src = url;
  });
}

export async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const img = await loadImageFromFile(file);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/**
 * Rasterize a crop of `file` into a JPEG blob matching `guide`.
 * When `transform` is omitted, uses a centered cover crop.
 */
export async function cropImageFileToAspect(
  file: File,
  guide: PhotoAspectGuide,
  transform: PhotoCropTransform = DEFAULT_PHOTO_CROP_TRANSFORM,
  frameSize?: { width: number; height: number }
): Promise<Blob> {
  const img = await loadImageFromFile(file);
  return cropHtmlImageToAspect(img, guide, transform, frameSize);
}

export async function cropImageUrlToAspect(
  url: string,
  guide: PhotoAspectGuide,
  transform: PhotoCropTransform = DEFAULT_PHOTO_CROP_TRANSFORM,
  frameSize?: { width: number; height: number }
): Promise<Blob> {
  const img = await loadImageFromUrl(url);
  return cropHtmlImageToAspect(img, guide, transform, frameSize);
}

function cropHtmlImageToAspect(
  img: HTMLImageElement,
  guide: PhotoAspectGuide,
  transform: PhotoCropTransform,
  frameSize: { width: number; height: number } | undefined
): Promise<Blob> {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) {
    return Promise.reject(new Error("Photo has no readable dimensions."));
  }

  const ratio = aspectRatio(guide);
  const frame =
    frameSize ??
    (ratio >= 1
      ? { width: 1000, height: Math.round(1000 / ratio) }
      : { width: Math.round(1000 * ratio), height: 1000 });

  const rect =
    transform.scale === 1 &&
    transform.offsetX === 0 &&
    transform.offsetY === 0 &&
    !frameSize
      ? centerCropRect(iw, ih, guide)
      : cropRectFromTransform(iw, ih, frame.width, frame.height, transform);

  const longEdge = Math.min(
    PHOTO_ASPECT_MAX_LONG_EDGE,
    Math.max(rect.sw, rect.sh)
  );
  const out = targetSizeFromLongEdge(guide, longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Could not crop this photo."));
  }

  ctx.drawImage(
    img,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    0,
    0,
    out.width,
    out.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode the cropped photo."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}

export function blobToJpegFile(blob: Blob, baseName: string): File {
  const safe =
    baseName.replace(/\.[^.]+$/, "").trim() || "photo";
  return new File([blob], `${safe}.jpg`, { type: "image/jpeg" });
}
