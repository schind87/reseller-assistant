/**
 * Background replacement via fal.ai:
 * 1) BiRefNet v2 for a high-quality garment cutout / mask
 * 2) EVF-SAM hanger mask unioned in so hooks/hangers are not clipped
 * 3) Drop disconnected leftover backdrop islands (wrinkles/folds)
 * 4) Composite onto a solid studio color
 */
import sharp from "sharp";

const DEFAULT_BACKGROUND = "#FFFFFF";

/** Filename marker so older cleaned files are regenerated after pipeline fixes. */
export const BG_PIPELINE_TAG = "bgv3";

export function isCurrentBgPipeline(
  processedPath: string | null | undefined
): boolean {
  return Boolean(
    processedPath && processedPath.includes(`-${BG_PIPELINE_TAG}-`)
  );
}

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
 * Fill enclosed holes inside the foreground so soft/noisy BiRefNet masks
 * don't punch white gaps through the garment.
 */
function fillForegroundHoles(
  alpha: Buffer,
  width: number,
  height: number
): Buffer {
  const n = width * height;
  if (alpha.length < n) return alpha;

  const outside = new Uint8Array(n);
  const qx = new Int32Array(n);
  const qy = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const enqueue = (x: number, y: number) => {
    const i = y * width + x;
    if (alpha[i] > 127 || outside[i]) return;
    outside[i] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const cx = qx[head];
    const cy = qy[head];
    head += 1;
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ] as const;
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      enqueue(nx, ny);
    }
  }

  const filled = Buffer.from(alpha);
  for (let i = 0; i < n; i++) {
    // Background pixels not reachable from the border are holes in the garment.
    if (filled[i] <= 127 && !outside[i]) filled[i] = 255;
  }
  return filled;
}

/**
 * Drop only small, far-away leftover islands (backdrop folds) while keeping
 * garment fragments near the main subject and hanger pieces.
 */
function pruneOrphanForeground(
  alpha: Buffer,
  width: number,
  height: number,
  protectGray: Buffer | null
): Buffer {
  const n = width * height;
  if (alpha.length < n) return alpha;

  const labels = new Int32Array(n);
  const areas: number[] = [0];
  const minX: number[] = [0];
  const minY: number[] = [0];
  const maxX: number[] = [0];
  const maxY: number[] = [0];
  let nextLabel = 0;

  const qx = new Int32Array(n);
  const qy = new Int32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (alpha[start] <= 127 || labels[start] !== 0) continue;

      nextLabel += 1;
      let area = 0;
      let head = 0;
      let tail = 0;
      let x0 = x;
      let y0 = y;
      let x1 = x;
      let y1 = y;
      qx[tail] = x;
      qy[tail] = y;
      tail += 1;
      labels[start] = nextLabel;

      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head += 1;
        area += 1;
        if (cx < x0) x0 = cx;
        if (cy < y0) y0 = cy;
        if (cx > x1) x1 = cx;
        if (cy > y1) y1 = cy;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ] as const;
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (alpha[ni] <= 127 || labels[ni] !== 0) continue;
          labels[ni] = nextLabel;
          qx[tail] = nx;
          qy[tail] = ny;
          tail += 1;
        }
      }

      areas[nextLabel] = area;
      minX[nextLabel] = x0;
      minY[nextLabel] = y0;
      maxX[nextLabel] = x1;
      maxY[nextLabel] = y1;
    }
  }

  if (nextLabel === 0) return alpha;

  let best = 1;
  for (let label = 2; label <= nextLabel; label++) {
    if (areas[label] > areas[best]) best = label;
  }

  const keep = new Set<number>([best]);
  // Keep any sizable fragment — only tiny leftovers are candidates for removal.
  const smallLimit = Math.max(80, Math.floor(areas[best] * 0.015));
  for (let label = 1; label <= nextLabel; label++) {
    if (areas[label] >= smallLimit) keep.add(label);
  }

  if (protectGray && protectGray.length >= n) {
    const overlap = new Array<number>(nextLabel + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const label = labels[i];
      if (label && protectGray[i] > 127) overlap[label] += 1;
    }
    const minOverlap = Math.max(16, Math.floor(areas[best] * 0.0002));
    for (let label = 1; label <= nextLabel; label++) {
      if (overlap[label] >= minOverlap) keep.add(label);
    }
  }

  // Keep blobs near the main garment (sleeve tips, straps) even if small.
  const pad = Math.max(24, Math.floor(Math.min(width, height) * 0.04));
  const nearMain = (label: number) => {
    const gapX =
      Math.max(0, minX[label] - maxX[best], minX[best] - maxX[label]) - pad;
    const gapY =
      Math.max(0, minY[label] - maxY[best], minY[best] - maxY[label]) - pad;
    return gapX <= 0 && gapY <= 0;
  };
  for (let label = 1; label <= nextLabel; label++) {
    if (nearMain(label)) keep.add(label);
  }

  // Thin hanger hooks sometimes separate — keep blobs that touch the top.
  const topBand = Math.max(8, Math.floor(height * 0.14));
  const minTopArea = Math.max(40, Math.floor(areas[best] * 0.005));
  for (let label = 1; label <= nextLabel; label++) {
    if (minY[label] <= topBand && areas[label] >= minTopArea) keep.add(label);
  }

  const cleaned = Buffer.from(alpha);
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (label && !keep.has(label)) cleaned[i] = 0;
  }
  return cleaned;
}

/**
 * Build a single alpha channel: refined BiRefNet cutout ∪ hanger mask,
 * with hole-fill and gentle orphan cleanup for leftover backdrop folds.
 */
async function buildUnionAlpha(params: {
  width: number;
  height: number;
  cutoutBytes: ArrayBuffer;
  birefnetMaskBytes: ArrayBuffer | null;
  hangerMaskBytes: ArrayBuffer | null;
}): Promise<Buffer> {
  const { width, height } = params;

  // Refined cutout alpha is the primary subject mask (better garment coverage).
  let alpha = await sharp(Buffer.from(params.cutoutBytes))
    .ensureAlpha()
    .extractChannel(3)
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer();

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

  let hangerGray: Buffer | null = null;
  if (params.hangerMaskBytes) {
    const usable = await maskHasForeground(params.hangerMaskBytes);
    if (usable) {
      hangerGray = await sharp(Buffer.from(params.hangerMaskBytes))
        .greyscale()
        .resize(width, height, { fit: "fill" })
        .raw()
        .toBuffer();
      for (let i = 0; i < alpha.length; i++) {
        if (hangerGray[i] > alpha[i]) alpha[i] = hangerGray[i];
      }
    }
  }

  alpha = fillForegroundHoles(alpha, width, height);
  return pruneOrphanForeground(alpha, width, height, hangerGray);
}

/**
 * Replace the photo background with a solid color while keeping the garment
 * (and optionally the full hanger) intact.
 */
export type ReplaceBackgroundSuccess = {
  ok: true;
  bytes: Buffer;
  contentType: string;
};

export type ReplaceBackgroundFailure = {
  ok: false;
  reason: "missing_fal_key" | "fal_failed" | "process_failed";
  detail?: string;
};

export type ReplaceBackgroundResult =
  | ReplaceBackgroundSuccess
  | ReplaceBackgroundFailure;

export async function replaceBackground(
  imageUrl: string,
  options: ReplaceBackgroundOptions = {}
): Promise<ReplaceBackgroundResult> {
  if (!falKey()) {
    return {
      ok: false,
      reason: "missing_fal_key",
      detail: "FAL_KEY is not configured on the server.",
    };
  }

  const backgroundColor = normalizeHexColor(options.backgroundColor);
  const keepHanger = options.keepHanger !== false;
  const { r, g, b } = hexToRgb(backgroundColor);

  try {
    const originalBytes = await fetchImageBytes(imageUrl);
    if (!originalBytes) {
      return {
        ok: false,
        reason: "process_failed",
        detail: "Could not download the original photo.",
      };
    }

    const [{ cutoutUrl, maskUrl }, hangerMaskUrl] = await Promise.all([
      birefnetCutoutAndMask(imageUrl),
      keepHanger ? segmentHangerMask(imageUrl) : Promise.resolve(null),
    ]);

    if (!cutoutUrl) {
      return {
        ok: false,
        reason: "fal_failed",
        detail:
          "fal.ai garment cutout failed. Check FAL_KEY and fal.ai status.",
      };
    }

    const cutout = await fetchImageBytes(cutoutUrl);
    if (!cutout) {
      return {
        ok: false,
        reason: "fal_failed",
        detail: "Could not download the fal.ai cutout.",
      };
    }

    const [birefnetMask, hangerMask] = await Promise.all([
      maskUrl ? fetchImageBytes(maskUrl) : Promise.resolve(null),
      hangerMaskUrl ? fetchImageBytes(hangerMaskUrl) : Promise.resolve(null),
    ]);

    const meta = await sharp(Buffer.from(originalBytes.bytes)).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) {
      return {
        ok: false,
        reason: "process_failed",
        detail: "Photo has no readable dimensions.",
      };
    }

    const alpha = await buildUnionAlpha({
      width,
      height,
      cutoutBytes: cutout.bytes,
      birefnetMaskBytes: birefnetMask?.bytes ?? null,
      hangerMaskBytes: hangerMask?.bytes ?? null,
    });

    // Original RGB + cleaned alpha, flattened onto the studio color.
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
      ok: true,
      bytes: composed,
      contentType: "image/png",
    };
  } catch (err) {
    console.error("replaceBackground failed:", err);
    return {
      ok: false,
      reason: "process_failed",
      detail: err instanceof Error ? err.message : "Background compose failed.",
    };
  }
}
