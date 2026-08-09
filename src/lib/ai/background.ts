/**
 * Background replacement via fal.ai:
 * 1) BiRefNet v2 for a high-quality garment cutout / mask
 * 2) EVF-SAM hanger mask unioned in so hooks/hangers are not clipped
 * 3) Composite onto a solid studio color (simple replacement)
 *
 * Returns processed image bytes, or null if FAL_KEY is missing / the call fails.
 */
import sharp from "sharp";

const DEFAULT_BACKGROUND = "#FFFFFF";

type FalImagePayload = {
  image?: { url?: string };
  images?: Array<{ url?: string }>;
  mask_image?: { url?: string };
};

export type ReplaceBackgroundOptions = {
  /** Solid hex color for the new backdrop. Default white. */
  backgroundColor?: string;
  /** Preserve full hanger (hook + bar) when present. Default true. */
  keepHanger?: boolean;
};

function falKey(): string | null {
  return process.env.FAL_KEY?.trim() || null;
}

async function falPost(
  modelPath: string,
  body: Record<string, unknown>
): Promise<FalImagePayload | null> {
  const key = falKey();
  if (!key) return null;

  try {
    const response = await fetch(`https://fal.run/${modelPath}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`fal ${modelPath} error:`, response.status, text);
      return null;
    }

    return (await response.json()) as FalImagePayload;
  } catch (err) {
    console.error(`fal ${modelPath} failed:`, err);
    return null;
  }
}

function firstImageUrl(data: FalImagePayload | null): string | null {
  if (!data) return null;
  return data.image?.url ?? data.images?.[0]?.url ?? null;
}

/**
 * Legacy helper: garment cutout only (transparent PNG URL).
 * Prefer replaceBackground() for listing photos.
 */
export async function removeBackground(
  imageUrl: string
): Promise<string | null> {
  const data = await falPost("fal-ai/birefnet/v2", {
    image_url: imageUrl,
    model: "General Use (Heavy)",
    operating_resolution: "2048x2048",
    refine_foreground: true,
    output_format: "png",
  });
  return firstImageUrl(data);
}

/**
 * Segment a clothes hanger (hook + body) with text-prompted EVF-SAM.
 * Returns a mask image URL, or null when none / unavailable.
 */
async function segmentHangerMask(imageUrl: string): Promise<string | null> {
  const data = await falPost("fal-ai/evf-sam", {
    image_url: imageUrl,
    prompt: "clothes hanger",
    negative_prompt: "background, wall, floor, person, mannequin",
    mask_only: true,
    use_grounding_dino: true,
    fill_holes: true,
    expand_mask: 3,
  });
  return firstImageUrl(data);
}

async function birefnetCutoutAndMask(
  imageUrl: string
): Promise<{ cutoutUrl: string | null; maskUrl: string | null }> {
  const data = await falPost("fal-ai/birefnet/v2", {
    image_url: imageUrl,
    model: "General Use (Heavy)",
    operating_resolution: "2048x2048",
    refine_foreground: true,
    output_mask: true,
    output_format: "png",
  });
  if (!data) return { cutoutUrl: null, maskUrl: null };
  return {
    cutoutUrl: firstImageUrl(data),
    maskUrl: data.mask_image?.url ?? null,
  };
}

/**
 * Download a processed image URL and return bytes for storage upload.
 */
export async function fetchImageBytes(
  url: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const bytes = await res.arrayBuffer();
    return { bytes, contentType };
  } catch (err) {
    console.error("fetchImageBytes failed:", err);
    return null;
  }
}

function normalizeHexColor(input: string | undefined): string {
  const raw = (input ?? DEFAULT_BACKGROUND).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_BACKGROUND;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/**
 * True when a binary/gray mask has enough foreground pixels to be useful.
 * Filters empty EVF-SAM results on flat lays.
 */
async function maskHasForeground(
  maskBytes: ArrayBuffer,
  minCoverage = 0.002
): Promise<boolean> {
  const { data, info } = await sharp(Buffer.from(maskBytes))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const total = info.width * info.height;
  if (total === 0) return false;

  let lit = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 127) lit += 1;
  }
  return lit / total >= minCoverage;
}

/**
 * Build a single alpha channel: BiRefNet garment ∪ hanger mask.
 * Falls back to the cutout's existing alpha when no separate mask exists.
 */
async function buildUnionAlpha(params: {
  width: number;
  height: number;
  cutoutBytes: ArrayBuffer;
  birefnetMaskBytes: ArrayBuffer | null;
  hangerMaskBytes: ArrayBuffer | null;
}): Promise<Buffer> {
  const { width, height } = params;

  const cutoutAlpha = await sharp(Buffer.from(params.cutoutBytes))
    .ensureAlpha()
    .extractChannel(3)
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer();

  const alpha = Buffer.from(cutoutAlpha);

  if (params.birefnetMaskBytes) {
    const maskGray = await sharp(Buffer.from(params.birefnetMaskBytes))
      .greyscale()
      .resize(width, height, { fit: "fill" })
      .raw()
      .toBuffer();
    for (let i = 0; i < alpha.length; i++) {
      if (maskGray[i] > alpha[i]) alpha[i] = maskGray[i];
    }
  }

  if (params.hangerMaskBytes) {
    const usable = await maskHasForeground(params.hangerMaskBytes);
    if (usable) {
      const hangerGray = await sharp(Buffer.from(params.hangerMaskBytes))
        .greyscale()
        .resize(width, height, { fit: "fill" })
        .raw()
        .toBuffer();
      for (let i = 0; i < alpha.length; i++) {
        if (hangerGray[i] > alpha[i]) alpha[i] = hangerGray[i];
      }
    }
  }

  return alpha;
}

/**
 * Replace the photo background with a solid color while keeping the garment
 * (and optionally the full hanger) intact.
 */
export async function replaceBackground(
  imageUrl: string,
  options: ReplaceBackgroundOptions = {}
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!falKey()) return null;

  const backgroundColor = normalizeHexColor(options.backgroundColor);
  const keepHanger = options.keepHanger !== false;
  const { r, g, b } = hexToRgb(backgroundColor);

  try {
    const originalBytes = await fetchImageBytes(imageUrl);
    if (!originalBytes) return null;

    const [{ cutoutUrl, maskUrl }, hangerMaskUrl] = await Promise.all([
      birefnetCutoutAndMask(imageUrl),
      keepHanger ? segmentHangerMask(imageUrl) : Promise.resolve(null),
    ]);

    if (!cutoutUrl) return null;

    const cutout = await fetchImageBytes(cutoutUrl);
    if (!cutout) return null;

    const [birefnetMask, hangerMask] = await Promise.all([
      maskUrl ? fetchImageBytes(maskUrl) : Promise.resolve(null),
      hangerMaskUrl ? fetchImageBytes(hangerMaskUrl) : Promise.resolve(null),
    ]);

    const meta = await sharp(Buffer.from(originalBytes.bytes)).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) return null;

    const alpha = await buildUnionAlpha({
      width,
      height,
      cutoutBytes: cutout.bytes,
      birefnetMaskBytes: birefnetMask?.bytes ?? null,
      hangerMaskBytes: hangerMask?.bytes ?? null,
    });

    // Original RGB + union alpha, flattened onto the studio color.
    const rgba = await sharp(Buffer.from(originalBytes.bytes))
      .ensureAlpha()
      .resize(width, height, { fit: "fill" })
      .raw()
      .toBuffer();

    for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
      rgba[p + 3] = alpha[i];
    }

    const foreground = await sharp(rgba, {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();

    const composed = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r, g, b },
      },
    })
      .composite([{ input: foreground, blend: "over" }])
      .png()
      .toBuffer();

    return {
      bytes: composed,
      contentType: "image/png",
    };
  } catch (err) {
    console.error("replaceBackground failed:", err);
    return null;
  }
}
