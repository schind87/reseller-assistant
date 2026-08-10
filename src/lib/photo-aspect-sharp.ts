import sharp from "sharp";
import type { PhotoAspectGuide } from "@/lib/platforms";
import {
  PHOTO_ASPECT_MAX_LONG_EDGE,
  isNearAspect,
  targetSizeFromLongEdge,
} from "@/lib/photo-aspect";

/**
 * Center-crop (cover) an image buffer onto the platform aspect.
 * No letterboxing — edges are trimmed as needed.
 */
export async function enforceAspectWithSharp(
  input: Buffer,
  guide: PhotoAspectGuide,
  maxLongEdge = PHOTO_ASPECT_MAX_LONG_EDGE
): Promise<Buffer> {
  // Honour EXIF Orientation before measuring / cropping.
  const oriented = await sharp(input).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("Photo has no readable dimensions.");
  }

  const longEdge = Math.min(maxLongEdge, Math.max(width, height));
  const target = targetSizeFromLongEdge(guide, longEdge);

  if (
    isNearAspect(width, height, guide) &&
    width === target.width &&
    height === target.height
  ) {
    return oriented;
  }

  // If already the right ratio but oversized, just scale down.
  if (isNearAspect(width, height, guide)) {
    return sharp(oriented)
      .resize(target.width, target.height, { fit: "inside" })
      .png()
      .toBuffer();
  }

  return sharp(oriented)
    .resize(target.width, target.height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}

/** Target Pixelcut / model canvas size from a source image + platform guide. */
export function platformTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  guide: PhotoAspectGuide,
  maxLongEdge = PHOTO_ASPECT_MAX_LONG_EDGE
): { width: number; height: number } {
  const longEdge = Math.min(
    maxLongEdge,
    Math.max(sourceWidth, sourceHeight, 1)
  );
  return targetSizeFromLongEdge(guide, longEdge);
}
