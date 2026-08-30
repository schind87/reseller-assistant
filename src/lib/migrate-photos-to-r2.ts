import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSafePhotoStoragePath,
  R2_COPY_BATCH_SIZE,
  type R2CopyTotals,
} from "@/lib/r2-copy";
import {
  downloadFromSupabaseStorage,
  getR2Object,
  isR2Configured,
  isThumbPath,
  makeListingThumbJpeg,
  PHOTO_BUCKET,
  putR2Object,
  r2ObjectExists,
  shouldWriteThumb,
  thumbPathFor,
} from "@/lib/photo-storage";

export { R2_COPY_BATCH_SIZE };
export type { R2CopyTotals };

export type CopyPhotoObjectResult = {
  copied: boolean;
  skipped: boolean;
  thumb: boolean;
  error?: string;
};

const PAGE_SIZE = 1000;

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function selectAllRows(
  table: string,
  columns: string,
  optional = false
): Promise<Record<string, unknown>[]> {
  const supabase = createAdminClient();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (optional) return rows;
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function addPath(paths: Set<string>, value: unknown) {
  if (typeof value !== "string" || !isSafePhotoStoragePath(value)) return;
  paths.add(value);
}

async function listSupabasePrefix(prefix: string): Promise<string[]> {
  const supabase = createAdminClient();
  const files: string[] = [];
  const folders = [prefix];
  while (folders.length > 0) {
    const current = folders.pop() ?? "";
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
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

async function collectDbPaths(): Promise<Set<string>> {
  const paths = new Set<string>();

  const photos = await selectAllRows(
    "listing_photos",
    "storage_path, processed_path"
  );
  for (const row of photos) {
    addPath(paths, row.storage_path);
    addPath(paths, row.processed_path);
  }

  const listings = await selectAllRows("listings", "cover_processed_path");
  for (const row of listings) {
    addPath(paths, row.cover_processed_path);
  }

  const labResults = await selectAllRows(
    "bg_lab_results",
    "storage_path",
    true
  );
  for (const row of labResults) {
    addPath(paths, row.storage_path);
  }

  const labRuns = await selectAllRows(
    "bg_lab_runs",
    "source_storage_path",
    true
  );
  for (const row of labRuns) {
    addPath(paths, row.source_storage_path);
  }

  return paths;
}

export async function listPhotoObjectKeysToCopy(): Promise<string[]> {
  const dbPaths = await collectDbPaths();
  const listed = await listSupabasePrefix("");
  const all = [...new Set([...dbPaths, ...listed])].filter(
    (path) => path && !isThumbPath(path) && isSafePhotoStoragePath(path)
  );
  all.sort();
  return all;
}

export async function copySupabasePhotoToR2(
  path: string
): Promise<CopyPhotoObjectResult> {
  if (!isR2Configured()) {
    return {
      copied: false,
      skipped: false,
      thumb: false,
      error: "R2 is not configured",
    };
  }
  if (!isSafePhotoStoragePath(path) || isThumbPath(path)) {
    return {
      copied: false,
      skipped: false,
      thumb: false,
      error: "Invalid photo path",
    };
  }
  try {
    const exists = await r2ObjectExists(path);
    let body: Buffer | null = null;
    let onR2 = exists;
    let copied = false;
    let skipped = false;

    if (exists) {
      skipped = true;
    } else {
      body = await downloadFromSupabaseStorage(path);
      if (!body) {
        return {
          copied: false,
          skipped: false,
          thumb: false,
          error: "Could not read photo from Supabase",
        };
      }
      await putR2Object(path, body, guessContentType(path));
      copied = true;
      onR2 = true;
    }

    let thumb = false;
    if (shouldWriteThumb(path)) {
      const thumbKey = thumbPathFor(path);
      if (await r2ObjectExists(thumbKey)) {
        thumb = true;
      } else if (onR2) {
        if (!body) body = await getR2Object(path);
        if (!body) body = await downloadFromSupabaseStorage(path);
        if (body) {
          const jpeg = await makeListingThumbJpeg(body);
          await putR2Object(thumbKey, jpeg, "image/jpeg");
          thumb = true;
        }
      }
    }

    return { copied, skipped, thumb };
  } catch (err) {
    return {
      copied: false,
      skipped: false,
      thumb: false,
      error: err instanceof Error ? err.message : "Copy failed",
    };
  }
}

export async function copyPhotoObjectBatch(
  paths: string[]
): Promise<R2CopyTotals> {
  const totals: R2CopyTotals = {
    copied: 0,
    skipped: 0,
    thumbs: 0,
    failed: 0,
    failedPaths: [],
  };
  for (const path of paths) {
    const result = await copySupabasePhotoToR2(path);
    if (result.error) {
      totals.failed += 1;
      totals.failedPaths.push(path);
      continue;
    }
    if (result.copied) totals.copied += 1;
    if (result.skipped) totals.skipped += 1;
    if (result.thumb) totals.thumbs += 1;
  }
  return totals;
}
