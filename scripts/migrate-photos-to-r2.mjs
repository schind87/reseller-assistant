/**
 * Copy listing photos from Supabase Storage (`listing-photos`) to Cloudflare R2.
 *
 * New uploads go to R2 once R2_* env vars are set. This script copies existing
 * objects and writes `{path}.thumb.jpg` sidecars (640×640 contain JPEG).
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-photos-to-r2.mjs
 *   node --env-file=.env.local scripts/migrate-photos-to-r2.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-photos-to-r2.mjs --skip-thumbs
 *
 * Does not delete Supabase originals unless you pass --delete-source.
 */
import { createClient } from "@supabase/supabase-js";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const BUCKET = "listing-photos";
const THUMB_SUFFIX = ".thumb.jpg";
const CONCURRENCY = 6;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipThumbs = args.has("--skip-thumbs");
const deleteSource = args.has("--delete-source");

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

function isThumbPath(path) {
  return path.endsWith(THUMB_SUFFIX);
}

function thumbPathFor(path) {
  return isThumbPath(path) ? path : `${path}${THUMB_SUFFIX}`;
}

function shouldWriteThumb(path) {
  if (!path || isThumbPath(path)) return false;
  return !path.startsWith("fal-orient/") && !path.startsWith("bg-lab/");
}

function isNotFound(err) {
  const name = err?.name ?? "";
  const code = err?.$metadata?.httpStatusCode ?? 0;
  return code === 404 || name === "NotFound" || name === "NoSuchKey";
}

async function mapPool(items, limit, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = required("SUPABASE_SERVICE_ROLE_KEY");
const accountId = required("R2_ACCOUNT_ID");
const accessKeyId = required("R2_ACCESS_KEY_ID");
const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
const r2Bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || BUCKET;
const endpoint =
  process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

async function r2Exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: key }));
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

async function r2Get(key) {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: r2Bucket, Key: key })
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("empty R2 object");
  return Buffer.from(bytes);
}

async function r2Put(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

async function listSupabasePrefix(prefix) {
  const files = [];
  const folders = [prefix];
  while (folders.length > 0) {
    const current = folders.pop();
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(current, {
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) {
        throw new Error(`list ${current || "(root)"}: ${error.message}`);
      }
      if (!data?.length) break;
      for (const item of data) {
        if (item.name === ".emptyFolderPlaceholder") continue;
        const full = current ? `${current}/${item.name}` : item.name;
        if (!item.metadata) {
          folders.push(full);
        } else {
          files.push(full);
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  return files;
}

async function collectDbPaths() {
  const paths = new Set();
  const { data: photos, error: photosError } = await supabase
    .from("listing_photos")
    .select("storage_path, processed_path");
  if (photosError) throw new Error(`listing_photos: ${photosError.message}`);
  for (const row of photos ?? []) {
    if (row.storage_path) paths.add(row.storage_path);
    if (row.processed_path) paths.add(row.processed_path);
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("cover_processed_path");
  if (listingsError) throw new Error(`listings: ${listingsError.message}`);
  for (const row of listings ?? []) {
    if (row.cover_processed_path) paths.add(row.cover_processed_path);
  }

  const { data: labResults, error: labError } = await supabase
    .from("bg_lab_results")
    .select("storage_path");
  if (labError) {
    console.warn("bg_lab_results skipped:", labError.message);
  } else {
    for (const row of labResults ?? []) {
      if (row.storage_path) paths.add(row.storage_path);
    }
  }

  const { data: labRuns, error: runsError } = await supabase
    .from("bg_lab_runs")
    .select("source_storage_path");
  if (runsError) {
    console.warn("bg_lab_runs skipped:", runsError.message);
  } else {
    for (const row of labRuns ?? []) {
      if (row.source_storage_path) paths.add(row.source_storage_path);
    }
  }

  return paths;
}

function guessContentType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function downloadSupabase(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message ?? "empty download");
  }
  return Buffer.from(await data.arrayBuffer());
}

async function makeThumb(bytes) {
  return sharp(bytes)
    .rotate()
    .resize(640, 640, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

async function main() {
  console.log(
    dryRun ? "Dry run — no writes." : "Copying Supabase listing-photos → R2."
  );
  console.log(`R2 bucket: ${r2Bucket}`);
  console.log(`Supabase: ${supabaseUrl}`);

  const dbPaths = await collectDbPaths();
  console.log(`DB object keys: ${dbPaths.size}`);

  const listed = new Set(await listSupabasePrefix(""));
  console.log(`Storage list keys: ${listed.size}`);

  const all = [...new Set([...dbPaths, ...listed])].filter(
    (path) => path && !isThumbPath(path)
  );
  all.sort();
  console.log(`Unique originals to copy: ${all.length}`);

  let copied = 0;
  let skipped = 0;
  let thumbs = 0;
  let failed = 0;
  let deleted = 0;

  await mapPool(all, CONCURRENCY, async (path, i) => {
    const label = `[${i + 1}/${all.length}] ${path}`;
    try {
      const exists = await r2Exists(path);
      let body = null;
      let onR2 = exists;
      if (exists) {
        skipped += 1;
      } else if (dryRun) {
        console.log(`would copy ${label}`);
        copied += 1;
        onR2 = true;
      } else {
        body = await downloadSupabase(path);
        await r2Put(path, body, guessContentType(path));
        copied += 1;
        onR2 = true;
        console.log(`copied ${label}`);
      }

      if (!skipThumbs && shouldWriteThumb(path)) {
        const thumbKey = thumbPathFor(path);
        const thumbExists = await r2Exists(thumbKey);
        if (thumbExists) {
          thumbs += 1;
        } else if (dryRun) {
          thumbs += 1;
        } else {
          if (!body) body = onR2 ? await r2Get(path) : await downloadSupabase(path);
          const jpeg = await makeThumb(body);
          await r2Put(thumbKey, jpeg, "image/jpeg");
          thumbs += 1;
        }
      }

      if (deleteSource && !dryRun && onR2) {
        const { error } = await supabase.storage.from(BUCKET).remove([path]);
        if (error) {
          console.warn(`delete-source ${path}: ${error.message}`);
        } else {
          deleted += 1;
        }
      }
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${label}:`, err instanceof Error ? err.message : err);
    }
  });

  console.log(
    JSON.stringify(
      { copied, skippedExisting: skipped, thumbs, failed, deleted, dryRun },
      null,
      2
    )
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
