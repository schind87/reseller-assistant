import sharp from "sharp";

export type OrientedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/jpeg";
};

/**
 * Apply EXIF Orientation into the pixel grid and drop the tag.
 * Phone JPEGs often store landscape pixels with Orientation=6/8; browsers
 * honor that tag, but some fal models (e.g. Ideogram rembg) do not — so the
 * cutout comes back sideways. Baking orientation first keeps every model
 * upright.
 */
export async function bakeExifOrientation(
  input: Buffer
): Promise<OrientedImage> {
  // sharp.rotate() with no angle applies EXIF orientation and resets the tag.
  const buffer = await sharp(input)
    .rotate()
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("Photo has no readable dimensions after orientation bake.");
  }
  return { buffer, width, height, contentType: "image/jpeg" };
}
