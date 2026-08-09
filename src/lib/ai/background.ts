/**
 * Background replacement providers (tried in order):
 * 1) PhotoRoom Remove Background API (PHOTOROOM_API_KEY) — best clothing quality
 * 2) Pixelcut Product Photo on fal (FAL_KEY) — e-commerce specialist
 * 3) Pixelcut/BiRefNet cutout + hanger-aware white composite (fallback)
 */
import sharp from "sharp";

export { BG_PIPELINE_TAG, isCurrentBgPipeline } from "@/lib/ai/bg-pipeline";

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

function photoroomKey(): string | null {
  return process.env.PHOTOROOM_API_KEY?.trim() || null;
}

function hasBgProvider(): boolean {
  return Boolean(falKey() || photoroomKey());
}

/**
 * PhotoRoom Remove Background API — proprietary e-commerce quality (~$0.02/img).
 * https://docs.photoroom.com/remove-background-api-basic-plan/quickstart-guide
 */
async function replaceWithPhotoroom(
  imageUrl: string,
  backgroundColor: string
): Promise<Buffer | null> {
  const key = photoroomKey();
  if (!key) return null;

  try {
    const source = await fetchImageBytes(imageUrl);
    if (!source) return null;

    const form = new FormData();
    const blob = new Blob([new Uint8Array(source.bytes)], {
      type: source.contentType || "image/jpeg",
    });
    form.append("image_file", blob, "photo.jpg");
    form.append("format", "png");
    // Solid studio backdrop (no alpha leftovers / soft wall fringes).
    form.append("bg_color", backgroundColor.replace("#", "").toUpperCase());
    form.append("channels", "rgba");
    form.append("size", "full");
    form.append("crop", "false");

    const response = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": key },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("photoroom segment error:", response.status, text);
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error("photoroom replace failed:", err);
    return null;
  }
}

/**
 * Pixelcut Product Photo on fal — e-commerce cutout + white studio canvas.
 * Better garment/hanger edges than generic BiRefNet for catalog shots.
 */
async function replaceWithPixelcut(
  imageUrl: string,
  backgroundColor: string,
  width: number,
  height: number
): Promise<Buffer | null> {
  if (!falKey()) return null;

  const { r, g, b } = hexToRgb(backgroundColor);
  const data = await falPost("pixelcut/product-photo", {
    image_url: imageUrl,
    image_size: { width, height },
    background: {
      mode: "Color",
      color: { r, g, b },
    },
    // Keep the original framing (no catalog re-crop).
    margin: { all: "0%" },
    output_format: "png",
    sync_mode: false,
  });

  const url = firstImageUrl(data);
  if (!url) return null;
  const downloaded = await fetchImageBytes(url);
  if (!downloaded) return null;
  return Buffer.from(downloaded.bytes);
}

/**
 * Pixelcut cutout only (transparent PNG) — used when we still need hanger
 * post-processing on top of a stronger base mask than BiRefNet.
 */
async function pixelcutCutout(imageUrl: string): Promise<string | null> {
  const data = await falPost("pixelcut/background-removal", {
    image_url: imageUrl,
    output_format: "rgba",
    sync_mode: false,
  });
  return firstImageUrl(data);
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
 * Thin mask only — never fill the open triangle in the middle of the hanger.
 */
async function segmentHangerMask(imageUrl: string): Promise<string | null> {
  const data = await falPost("fal-ai/evf-sam", {
    image_url: imageUrl,
    prompt: "clothes hanger hook and arms",
    negative_prompt:
      "background, wall, floor, empty space inside hanger, shirt, garment",
    mask_only: true,
    use_grounding_dino: true,
    fill_holes: false,
    expand_mask: 1,
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
 * Fill only *small* enclosed holes inside the foreground (noisy BiRefNet gaps
 * in fabric). Large enclosed regions — especially the open triangle in the
 * middle of a hanger — stay background so they pick up the studio color.
 */
function fillSmallForegroundHoles(
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

  const enqueueOutside = (x: number, y: number) => {
    const i = y * width + x;
    if (alpha[i] > 127 || outside[i]) return;
    outside[i] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x++) {
    enqueueOutside(x, 0);
    enqueueOutside(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueueOutside(0, y);
    enqueueOutside(width - 1, y);
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
      enqueueOutside(nx, ny);
    }
  }

  // Label enclosed background components (holes).
  const labels = new Int32Array(n);
  const areas: number[] = [0];
  let nextLabel = 0;
  head = 0;
  tail = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (alpha[start] > 127 || outside[start] || labels[start] !== 0) continue;

      nextLabel += 1;
      let area = 0;
      qx[tail] = x;
      qy[tail] = y;
      tail += 1;
      labels[start] = nextLabel;

      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head += 1;
        area += 1;
        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ] as const;
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (alpha[ni] > 127 || outside[ni] || labels[ni] !== 0) continue;
          labels[ni] = nextLabel;
          qx[tail] = nx;
          qy[tail] = ny;
          tail += 1;
        }
      }
      areas[nextLabel] = area;
    }
  }

  // Hanger gaps are typically large; fabric speckles are tiny.
  const maxHoleArea = Math.max(400, Math.floor(n * 0.004));
  const fillLabel = new Uint8Array(nextLabel + 1);
  for (let label = 1; label <= nextLabel; label++) {
    if (areas[label] <= maxHoleArea) fillLabel[label] = 1;
  }

  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (label && fillLabel[label]) alpha[i] = 255;
  }
  return alpha;
}

/**
 * Hard matte: kill soft shadow fringes that leave the original wall color.
 */
function hardenAlpha(alpha: Buffer, threshold = 160): Buffer {
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = alpha[i] >= threshold ? 255 : 0;
  }
  return alpha;
}

/**
 * Punch leftover original backdrop that BiRefNet/hanger-fill trapped as
 * "foreground" (classic: wall color inside the hanger triangle). Never punches
 * the eroded garment core or thin hanger plastic.
 */
function punchTrappedBackdrop(params: {
  alpha: Buffer;
  rgba: Buffer;
  width: number;
  height: number;
  hangerGray: Buffer | null;
}): void {
  const { alpha, rgba, width, height, hangerGray } = params;
  const n = width * height;
  if (alpha.length < n || rgba.length < n * 4) return;

  // Median-ish background sample from the outer border.
  const samples: number[] = [];
  const pushSample = (x: number, y: number) => {
    const i = y * width + x;
    if (alpha[i] > 127) return;
    const p = i * 4;
    samples.push(rgba[p], rgba[p + 1], rgba[p + 2]);
  };
  const border = Math.max(2, Math.floor(Math.min(width, height) * 0.02));
  for (let x = 0; x < width; x++) {
    for (let t = 0; t < border; t++) {
      pushSample(x, t);
      pushSample(x, height - 1 - t);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let t = 0; t < border; t++) {
      pushSample(t, y);
      pushSample(width - 1 - t, y);
    }
  }
  if (samples.length < 30) return;

  const channel = (offset: number) => {
    const vals: number[] = [];
    for (let i = offset; i < samples.length; i += 3) vals.push(samples[i]);
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)] ?? 255;
  };
  const bgR = channel(0);
  const bgG = channel(1);
  const bgB = channel(2);

  // Protect solid garment: erode the current mask a few times.
  const core = Buffer.from(alpha);
  const erodeOnce = (src: Buffer, dest: Buffer) => {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (
          src[i] > 127 &&
          src[i - 1] > 127 &&
          src[i + 1] > 127 &&
          src[i - width] > 127 &&
          src[i + width] > 127
        ) {
          dest[i] = 255;
        } else {
          dest[i] = 0;
        }
      }
    }
  };
  const tmp = Buffer.alloc(n);
  const erodePasses = Math.max(3, Math.floor(Math.min(width, height) * 0.008));
  for (let pass = 0; pass < erodePasses; pass++) {
    erodeOnce(core, tmp);
    core.set(tmp);
  }

  const maxDist = 42; // ≈ wall / soft-shadow match; blue shirts stay far away
  for (let i = 0; i < n; i++) {
    if (alpha[i] <= 127) continue;
    if (core[i] > 127) continue;
    if (hangerGray && hangerGray[i] > 127) continue;

    const p = i * 4;
    const dr = rgba[p] - bgR;
    const dg = rgba[p + 1] - bgG;
    const db = rgba[p + 2] - bgB;
    if (dr * dr + dg * dg + db * db <= maxDist * maxDist) {
      alpha[i] = 0;
    }
  }
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

  const cleaned = alpha;
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (label && !keep.has(label)) cleaned[i] = 0;
  }
  return cleaned;
}

/**
 * Build a single alpha channel: refined BiRefNet cutout ∪ thin hanger mask,
 * with small hole-fill and gentle orphan cleanup for leftover backdrop folds.
 * Large hanger interiors are left open so they take the studio color.
 */
async function buildUnionAlpha(params: {
  width: number;
  height: number;
  cutoutBytes: ArrayBuffer;
  birefnetMaskBytes: ArrayBuffer | null;
  hangerMaskBytes: ArrayBuffer | null;
}): Promise<{ alpha: Buffer; hangerGray: Buffer | null }> {
  const { width, height } = params;

  // Refined cutout alpha is the primary subject mask (better garment coverage).
  const alpha = await sharp(Buffer.from(params.cutoutBytes))
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

  // Fill tiny fabric speckles before adding the hanger, so we never flood-fill
  // the open triangle in the middle of the hanger.
  fillSmallForegroundHoles(alpha, width, height);

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

  pruneOrphanForeground(alpha, width, height, hangerGray);
  hardenAlpha(alpha);
  return { alpha, hangerGray };
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
  if (!hasBgProvider()) {
    return {
      ok: false,
      reason: "missing_fal_key",
      detail:
        "Set PHOTOROOM_API_KEY (preferred) and/or FAL_KEY for Clean background.",
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

    // 1) PhotoRoom — closest quality to the consumer Photoroom app.
    const photoroom = await replaceWithPhotoroom(imageUrl, backgroundColor);
    if (photoroom) {
      return { ok: true, bytes: photoroom, contentType: "image/png" };
    }

    // 2) Pixelcut Product Photo — e-commerce specialist on fal (~$0.024).
    const pixelcut = await replaceWithPixelcut(
      imageUrl,
      backgroundColor,
      width,
      height
    );
    if (pixelcut) {
      return { ok: true, bytes: pixelcut, contentType: "image/png" };
    }

    // 3) Fallback: Pixelcut/BiRefNet cutout + hanger-aware composite.
    return await replaceWithCutoutComposite({
      imageUrl,
      originalBytes: originalBytes.bytes,
      width,
      height,
      backgroundRgb: { r, g, b },
      keepHanger,
    });
  } catch (err) {
    console.error("replaceBackground failed:", err);
    return {
      ok: false,
      reason: "process_failed",
      detail: err instanceof Error ? err.message : "Background compose failed.",
    };
  }
}

async function replaceWithCutoutComposite(params: {
  imageUrl: string;
  originalBytes: ArrayBuffer;
  width: number;
  height: number;
  backgroundRgb: { r: number; g: number; b: number };
  keepHanger: boolean;
}): Promise<ReplaceBackgroundResult> {
  const { imageUrl, originalBytes, width, height, backgroundRgb, keepHanger } =
    params;
  const { r, g, b } = backgroundRgb;

  if (!falKey()) {
    return {
      ok: false,
      reason: "fal_failed",
      detail:
        "PhotoRoom/Pixelcut unavailable and FAL_KEY is missing for fallback.",
    };
  }

  try {
    const pixelcutUrl = await pixelcutCutout(imageUrl);
    const birefnet = pixelcutUrl
      ? { cutoutUrl: pixelcutUrl, maskUrl: null as string | null }
      : await birefnetCutoutAndMask(imageUrl);

    const hangerMaskUrl = keepHanger
      ? await segmentHangerMask(imageUrl)
      : null;

    if (!birefnet.cutoutUrl) {
      return {
        ok: false,
        reason: "fal_failed",
        detail:
          "Background cutout failed (PhotoRoom, Pixelcut, and BiRefNet). Check API keys.",
      };
    }

    const cutout = await fetchImageBytes(birefnet.cutoutUrl);
    if (!cutout) {
      return {
        ok: false,
        reason: "fal_failed",
        detail: "Could not download the cutout image.",
      };
    }

    const [birefnetMask, hangerMask] = await Promise.all([
      birefnet.maskUrl
        ? fetchImageBytes(birefnet.maskUrl)
        : Promise.resolve(null),
      hangerMaskUrl ? fetchImageBytes(hangerMaskUrl) : Promise.resolve(null),
    ]);

    const { alpha, hangerGray } = await buildUnionAlpha({
      width,
      height,
      cutoutBytes: cutout.bytes,
      birefnetMaskBytes: birefnetMask?.bytes ?? null,
      hangerMaskBytes: hangerMask?.bytes ?? null,
    });

    const rgba = await sharp(Buffer.from(originalBytes))
      .ensureAlpha()
      .resize(width, height, { fit: "fill" })
      .raw()
      .toBuffer();

    punchTrappedBackdrop({
      alpha,
      rgba,
      width,
      height,
      hangerGray,
    });

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
    console.error("replaceWithCutoutComposite failed:", err);
    return {
      ok: false,
      reason: "process_failed",
      detail: err instanceof Error ? err.message : "Background compose failed.",
    };
  }
}
