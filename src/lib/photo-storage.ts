import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const PHOTO_BUCKET = "listing-photos";
export const THUMB_SUFFIX = ".thumb.jpg";

export type PhotoSignTransform = {
  width: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
};

/** Listing hub / home grid thumbs. R2 stores a JPEG sidecar at `{path}.thumb.jpg`. */
export const LISTING_GRID_THUMB: PhotoSignTransform = {
  width: 640,
  height: 640,
  resize: "contain",
  quality: 72,
};

const r2KnownKeys = new Set<string>();
let s3Client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET)
  );
}

export function r2BucketName(): string {
  return process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || PHOTO_BUCKET;
}

export function isThumbPath(path: string): boolean {
  return path.endsWith(THUMB_SUFFIX);
}

export function thumbPathFor(storagePath: string): string {
  if (isThumbPath(storagePath)) return storagePath;
  return `${storagePath}${THUMB_SUFFIX}`;
}

/** Skip sidecar thumbs for short-lived fal temps and lab outputs. */
export function shouldWriteThumb(path: string): boolean {
  if (!path || isThumbPath(path)) return false;
  return !path.startsWith("fal-orient/") && !path.startsWith("bg-lab/");
}

function getS3(): S3Client {
  if (s3Client) return s3Client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured");
  }
  const endpoint =
    process.env.R2_ENDPOINT ||
    `https://${accountId}.r2.cloudflarestorage.com`;
  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // AWS SDK v3 flexible checksums break R2 PutObject.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3Client;
}

function toBuffer(bytes: ArrayBuffer | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(bytes)) return bytes;
  return Buffer.from(new Uint8Array(bytes));
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  const code =
    "$metadata" in err &&
    err.$metadata &&
    typeof err.$metadata === "object" &&
    "httpStatusCode" in err.$metadata
      ? Number(err.$metadata.httpStatusCode)
      : 0;
  return (
    code === 404 ||
    name === "NotFound" ||
    name === "NoSuchKey" ||
    name === "NotFoundError"
  );
}

async function r2Head(key: string): Promise<boolean> {
  if (r2KnownKeys.has(key)) return true;
  try {
    await getS3().send(
      new HeadObjectCommand({ Bucket: r2BucketName(), Key: key })
    );
    r2KnownKeys.add(key);
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

async function r2Put(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  r2KnownKeys.add(key);
}

async function r2Get(key: string): Promise<Buffer | null> {
  try {
    const res = await getS3().send(
      new GetObjectCommand({ Bucket: r2BucketName(), Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) return null;
    r2KnownKeys.add(key);
    return Buffer.from(bytes);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function r2Sign(key: string, expiresIn: number): Promise<string> {
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({ Bucket: r2BucketName(), Key: key }),
    { expiresIn }
  );
}

async function r2Delete(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return;
  const Bucket = r2BucketName();
  const client = getS3();
  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
    for (const key of chunk) r2KnownKeys.delete(key);
  }
}

async function supabaseUpload(
  path: string,
  body: Buffer,
  contentType: string,
  upsert: boolean
): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .upload(path, body, { contentType, upsert });
  if (error) throw new Error(error.message);
}

async function supabaseDownload(path: string): Promise<Buffer | null> {
  const { data, error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function supabaseRemove(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .remove(unique);
  if (error) {
    console.error("photo-storage supabase remove:", error.message);
  }
}

async function supabaseSign(
  path: string,
  expiresIn: number,
  transform?: PhotoSignTransform
): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrl(
      path,
      expiresIn,
      transform ? { transform } : undefined
    );
  if (error) {
    console.error("photo-storage supabase sign:", path, error.message);
    return null;
  }
  return data.signedUrl ?? null;
}

async function supabaseSignMany(
  paths: string[],
  expiresIn: number
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const { data, error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls(paths, expiresIn);

  if (error) {
    console.error("photo-storage supabase sign many:", error.message);
    await Promise.all(
      paths.map(async (path) => {
        out.set(path, await supabaseSign(path, expiresIn));
      })
    );
    return out;
  }

  for (const path of paths) out.set(path, null);
  for (const row of data ?? []) {
    if (!row.path) continue;
    out.set(row.path, row.signedUrl ?? null);
  }
  const missing = paths.filter((path) => !out.get(path));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (path) => {
        out.set(path, await supabaseSign(path, expiresIn));
      })
    );
  }
  return out;
}

export async function makeListingThumbJpeg(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
    .resize(LISTING_GRID_THUMB.width, LISTING_GRID_THUMB.height ?? 640, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: LISTING_GRID_THUMB.quality ?? 72, mozjpeg: true })
    .toBuffer();
}

async function writeThumb(path: string, original: Buffer): Promise<void> {
  if (!shouldWriteThumb(path) || !isR2Configured()) return;
  try {
    const thumb = await makeListingThumbJpeg(original);
    await r2Put(thumbPathFor(path), thumb, "image/jpeg");
  } catch (err) {
    console.error(
      "photo-storage thumb:",
      path,
      err instanceof Error ? err.message : err
    );
  }
}

export async function uploadPhotoObject(params: {
  path: string;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  contentType: string;
  upsert?: boolean;
}): Promise<void> {
  const body = toBuffer(params.bytes);
  const upsert = params.upsert ?? false;

  if (isR2Configured()) {
    if (!upsert && (await r2Head(params.path))) {
      throw new Error(`Object already exists: ${params.path}`);
    }
    await r2Put(params.path, body, params.contentType);
    await writeThumb(params.path, body);
    return;
  }

  await supabaseUpload(params.path, body, params.contentType, upsert);
}

export async function downloadPhotoObject(
  path: string
): Promise<Buffer | null> {
  if (!path) return null;
  if (isR2Configured()) {
    const fromR2 = await r2Get(path);
    if (fromR2) return fromR2;
  }
  return supabaseDownload(path);
}

function keysToDelete(paths: string[]): string[] {
  const keys: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    keys.push(path);
    if (shouldWriteThumb(path)) keys.push(thumbPathFor(path));
  }
  return [...new Set(keys)];
}

export async function removePhotoObjects(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const keys = keysToDelete(unique);
  if (isR2Configured()) {
    try {
      await r2Delete(keys);
    } catch (err) {
      console.error(
        "photo-storage r2 delete:",
        err instanceof Error ? err.message : err
      );
    }
  }
  await supabaseRemove(unique);
}

async function ensureR2Thumb(path: string): Promise<string | null> {
  const thumbKey = thumbPathFor(path);
  if (await r2Head(thumbKey)) return thumbKey;
  const original = await downloadPhotoObject(path);
  if (!original) return null;
  try {
    const thumb = await makeListingThumbJpeg(original);
    await r2Put(thumbKey, thumb, "image/jpeg");
    return thumbKey;
  } catch (err) {
    console.error(
      "photo-storage ensure thumb:",
      path,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function signOne(
  path: string,
  expiresIn: number,
  transform?: PhotoSignTransform
): Promise<string | null> {
  if (isR2Configured()) {
    if (transform) {
      const thumbKey = await ensureR2Thumb(path);
      if (thumbKey) return r2Sign(thumbKey, expiresIn);
      if (await r2Head(path)) return r2Sign(path, expiresIn);
      return supabaseSign(path, expiresIn, transform);
    }
    if (await r2Head(path)) return r2Sign(path, expiresIn);
  }
  return supabaseSign(path, expiresIn, transform);
}

export async function getSignedPhotoUrl(
  storagePath: string,
  expiresIn = 3600,
  transform?: PhotoSignTransform
): Promise<string | null> {
  if (!storagePath) return null;
  const map = await getSignedPhotoUrls([storagePath], expiresIn, transform);
  return map.get(storagePath) ?? null;
}

/** Sign many storage paths. Transform requests use R2 JPEG sidecars when R2 is on. */
export async function getSignedPhotoUrls(
  storagePaths: string[],
  expiresIn = 3600,
  transform?: PhotoSignTransform
): Promise<Map<string, string | null>> {
  const unique = [
    ...new Set(storagePaths.filter((p): p is string => Boolean(p))),
  ];
  const out = new Map<string, string | null>();
  if (unique.length === 0) return out;

  if (!isR2Configured() && !transform) {
    return supabaseSignMany(unique, expiresIn);
  }

  await Promise.all(
    unique.map(async (path) => {
      try {
        out.set(path, await signOne(path, expiresIn, transform));
      } catch (err) {
        console.error(
          "getSignedPhotoUrls:",
          path,
          err instanceof Error ? err.message : err
        );
        out.set(path, null);
      }
    })
  );
  return out;
}
