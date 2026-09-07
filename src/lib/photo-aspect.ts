import type { PhotoAspectGuide } from "@/lib/platforms";

/** Max long-edge pixels for cropped listing JPEGs (matches CameraCapture). */
export const PHOTO_ASPECT_MAX_LONG_EDGE = 1600;

/** Shrink a camera or library image so phone uploads stay under the server body limit. */
export async function jpegBlobForUpload(
  source: Blob,
  maxLongEdge = PHOTO_ASPECT_MAX_LONG_EDGE,
  quality = 0.88
): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return source;
  try {
    const bitmap = await createImageBitmap(source);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return source;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
    });
    return blob && blob.size > 0 ? blob : source;
  } catch {
    return source;
  }
}

/** Relative tolerance when deciding a photo already matches the platform frame. */
export const PHOTO_ASPECT_NEAR_TOLERANCE = 0.02;

/** How far the crop outline can zoom in (1 = largest fit). */
export const PHOTO_CROP_MAX_ZOOM = 4;

export type PhotoCropTransform = {
  /**
   * Zoom relative to the largest aspect-fit crop.
   * 1 = biggest outline that fits; higher = smaller outline (zoom in).
   */
  scale: number;
  /** Horizontal position of the outline within travel range (0 = left, 1 = right). */
  nx: number;
  /** Vertical position of the outline within travel range (0 = top, 1 = bottom). */
  ny: number;
};

export const DEFAULT_PHOTO_CROP_TRANSFORM: PhotoCropTransform = {
  scale: 1,
  nx: 0.5,
  ny: 0.5,
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

/**
 * Source rectangle for a movable aspect outline over the full photo.
 * `scale` 1 = largest fit; higher = tighter crop. `nx`/`ny` slide the outline.
 */
export function cropRectFromOutline(
  imageWidth: number,
  imageHeight: number,
  guide: PhotoAspectGuide,
  transform: PhotoCropTransform
): ImageCropRect {
  const scale = Math.min(
    PHOTO_CROP_MAX_ZOOM,
    Math.max(1, transform.scale)
  );
  const full = centerCropRect(imageWidth, imageHeight, guide);
  const sw = full.sw / scale;
  const sh = full.sh / scale;
  const maxX = Math.max(0, imageWidth - sw);
  const maxY = Math.max(0, imageHeight - sh);
  const nx = Math.min(1, Math.max(0, transform.nx));
  const ny = Math.min(1, Math.max(0, transform.ny));
  return {
    sx: nx * maxX,
    sy: ny * maxY,
    sw,
    sh,
  };
}

export function clampCropTransform(
  transform: PhotoCropTransform
): PhotoCropTransform {
  return {
    scale: Math.min(PHOTO_CROP_MAX_ZOOM, Math.max(1, transform.scale)),
    nx: Math.min(1, Math.max(0, transform.nx)),
    ny: Math.min(1, Math.max(0, transform.ny)),
  };
}

export type CropCorner = "nw" | "ne" | "sw" | "se";

/**
 * Convert an aspect-correct source rect into a crop transform.
 * Rect size outside the allowed zoom range is clamped first.
 */
export function transformFromCropRect(
  imageWidth: number,
  imageHeight: number,
  guide: PhotoAspectGuide,
  rect: ImageCropRect
): PhotoCropTransform {
  const full = centerCropRect(imageWidth, imageHeight, guide);
  const minSw = full.sw / PHOTO_CROP_MAX_ZOOM;
  const minSh = full.sh / PHOTO_CROP_MAX_ZOOM;
  let sw = Math.min(full.sw, Math.max(minSw, rect.sw));
  let sh = Math.min(full.sh, Math.max(minSh, rect.sh));
  // Keep aspect exact after clamp (prefer width as source of truth).
  const target = aspectRatio(guide);
  sh = sw / target;
  if (sh > full.sh) {
    sh = full.sh;
    sw = sh * target;
  }
  if (sh < minSh) {
    sh = minSh;
    sw = sh * target;
  }
  const maxX = Math.max(0, imageWidth - sw);
  const maxY = Math.max(0, imageHeight - sh);
  const sx = Math.min(maxX, Math.max(0, rect.sx));
  const sy = Math.min(maxY, Math.max(0, rect.sy));
  return clampCropTransform({
    scale: full.sw / sw,
    nx: maxX > 0 ? sx / maxX : 0.5,
    ny: maxY > 0 ? sy / maxY : 0.5,
  });
}

/**
 * Resize the crop outline from a corner while locking aspect ratio.
 * The opposite corner stays fixed; size is limited to the image and zoom range.
 */
export function resizeCropRectFromCorner(
  imageWidth: number,
  imageHeight: number,
  guide: PhotoAspectGuide,
  current: ImageCropRect,
  corner: CropCorner,
  pointerX: number,
  pointerY: number
): ImageCropRect {
  const target = aspectRatio(guide);
  const full = centerCropRect(imageWidth, imageHeight, guide);
  const minSw = full.sw / PHOTO_CROP_MAX_ZOOM;
  const minSh = full.sh / PHOTO_CROP_MAX_ZOOM;

  const right = current.sx + current.sw;
  const bottom = current.sy + current.sh;

  let anchorX: number;
  let anchorY: number;
  switch (corner) {
    case "nw":
      anchorX = right;
      anchorY = bottom;
      break;
    case "ne":
      anchorX = current.sx;
      anchorY = bottom;
      break;
    case "sw":
      anchorX = right;
      anchorY = current.sy;
      break;
    case "se":
      anchorX = current.sx;
      anchorY = current.sy;
      break;
    default: {
      const _exhaustive: never = corner;
      return _exhaustive;
    }
  }

  // Max size from this anchor without leaving the image.
  let maxW: number;
  let maxH: number;
  switch (corner) {
    case "nw":
      maxW = anchorX;
      maxH = anchorY;
      break;
    case "ne":
      maxW = imageWidth - anchorX;
      maxH = anchorY;
      break;
    case "sw":
      maxW = anchorX;
      maxH = imageHeight - anchorY;
      break;
    case "se":
      maxW = imageWidth - anchorX;
      maxH = imageHeight - anchorY;
      break;
    default: {
      const _exhaustive: never = corner;
      return _exhaustive;
    }
  }
  maxW = Math.min(full.sw, Math.max(0, maxW));
  maxH = Math.min(full.sh, Math.max(0, maxH));
  const maxByAspect = Math.min(maxW, maxH * target);
  const maxSw = Math.max(minSw, maxByAspect);
  const maxSh = maxSw / target;

  let proposedW: number;
  let proposedH: number;
  switch (corner) {
    case "nw":
      proposedW = anchorX - pointerX;
      proposedH = anchorY - pointerY;
      break;
    case "ne":
      proposedW = pointerX - anchorX;
      proposedH = anchorY - pointerY;
      break;
    case "sw":
      proposedW = anchorX - pointerX;
      proposedH = pointerY - anchorY;
      break;
    case "se":
      proposedW = pointerX - anchorX;
      proposedH = pointerY - anchorY;
      break;
    default: {
      const _exhaustive: never = corner;
      return _exhaustive;
    }
  }

  proposedW = Math.max(0, proposedW);
  proposedH = Math.max(0, proposedH);

  // Fit inside the pointer box while keeping aspect (Instagram-style).
  let sw = Math.min(proposedW, proposedH * target);
  if (!Number.isFinite(sw) || sw <= 0) {
    sw = Math.min(current.sw, maxSw);
  }
  sw = Math.min(maxSw, Math.max(minSw, sw));
  let sh = sw / target;
  if (sh > maxSh) {
    sh = maxSh;
    sw = sh * target;
  }

  let sx: number;
  let sy: number;
  switch (corner) {
    case "nw":
      sx = anchorX - sw;
      sy = anchorY - sh;
      break;
    case "ne":
      sx = anchorX;
      sy = anchorY - sh;
      break;
    case "sw":
      sx = anchorX - sw;
      sy = anchorY;
      break;
    case "se":
      sx = anchorX;
      sy = anchorY;
      break;
    default: {
      const _exhaustive: never = corner;
      return _exhaustive;
    }
  }

  sx = Math.min(Math.max(0, imageWidth - sw), Math.max(0, sx));
  sy = Math.min(Math.max(0, imageHeight - sh), Math.max(0, sy));

  return { sx, sy, sw, sh };
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
  transform: PhotoCropTransform = DEFAULT_PHOTO_CROP_TRANSFORM
): Promise<Blob> {
  const img = await loadImageFromFile(file);
  return cropHtmlImageToAspect(img, guide, transform);
}

export async function cropImageUrlToAspect(
  url: string,
  guide: PhotoAspectGuide,
  transform: PhotoCropTransform = DEFAULT_PHOTO_CROP_TRANSFORM
): Promise<Blob> {
  const img = await loadImageFromUrl(url);
  return cropHtmlImageToAspect(img, guide, transform);
}

function cropHtmlImageToAspect(
  img: HTMLImageElement,
  guide: PhotoAspectGuide,
  transform: PhotoCropTransform
): Promise<Blob> {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) {
    return Promise.reject(new Error("Photo has no readable dimensions."));
  }

  const rect = cropRectFromOutline(iw, ih, guide, transform);

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
