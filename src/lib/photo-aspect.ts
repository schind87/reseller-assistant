import type { PhotoAspectGuide } from "@/lib/platforms";

/** Max long-edge pixels for cropped listing JPEGs (matches CameraCapture). */
export const PHOTO_ASPECT_MAX_LONG_EDGE = 1600;

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
