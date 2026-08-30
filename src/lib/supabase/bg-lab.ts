import {
  getSignedPhotoUrl,
  getSignedPhotoUrls,
  uploadPhotoObject,
} from "@/lib/photo-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { falDashboardUrl } from "@/lib/ai/fal-lab";

export type BgLabResultRating = "up" | "down";

export type BgLabResultRow = {
  id: string;
  run_id: string;
  model_id: string;
  model_label: string;
  provider: "fal" | "photoroom";
  ok: boolean;
  ms: number;
  storage_path: string | null;
  fal_request_id: string | null;
  fal_endpoint: string | null;
  cost_usd: number | null;
  cost_unit_price: number | null;
  cost_units: number | null;
  cost_currency: string | null;
  cost_source: string | null;
  error: string | null;
  rating: BgLabResultRating | null;
  created_at: string;
  imageUrl: string | null;
  dashboardUrl: string | null;
};

export type BgLabRunRow = {
  id: string;
  listing_photo_id: string;
  listing_id: string;
  run_by_user_id: string | null;
  composite_white: boolean;
  source_storage_path: string | null;
  created_at: string;
  results: BgLabResultRow[];
};

function dashboardUrlFor(
  requestId: string | null,
  endpointId: string | null
): string | null {
  if (!requestId && !endpointId) return null;
  return falDashboardUrl(requestId, endpointId);
}

export async function createBgLabRun(params: {
  photoId: string;
  listingId: string;
  runByUserId: string | null;
  compositeWhite: boolean;
  sourceStoragePath?: string | null;
}): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bg_lab_runs")
    .insert({
      listing_photo_id: params.photoId,
      listing_id: params.listingId,
      run_by_user_id: params.runByUserId,
      composite_white: params.compositeWhite,
      source_storage_path: params.sourceStoragePath ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createBgLabRun: ${error.message}`);
  return { id: data.id as string };
}

export async function insertBgLabResult(params: {
  runId: string;
  modelId: string;
  modelLabel: string;
  provider: "fal" | "photoroom";
  ok: boolean;
  ms: number;
  storagePath?: string | null;
  falRequestId?: string | null;
  falEndpoint?: string | null;
  costUsd?: number | null;
  costUnitPrice?: number | null;
  costUnits?: number | null;
  costCurrency?: string | null;
  costSource?: string | null;
  error?: string | null;
}): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bg_lab_results")
    .insert({
      run_id: params.runId,
      model_id: params.modelId,
      model_label: params.modelLabel,
      provider: params.provider,
      ok: params.ok,
      ms: params.ms,
      storage_path: params.storagePath ?? null,
      fal_request_id: params.falRequestId ?? null,
      fal_endpoint: params.falEndpoint ?? null,
      cost_usd: params.costUsd ?? null,
      cost_unit_price: params.costUnitPrice ?? null,
      cost_units: params.costUnits ?? null,
      cost_currency: params.costCurrency ?? "USD",
      cost_source: params.costSource ?? null,
      error: params.error ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insertBgLabResult: ${error.message}`);
  return { id: data.id as string };
}

export async function updateBgLabResultRating(params: {
  resultId: string;
  rating: BgLabResultRating | null;
}): Promise<BgLabResultRating | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bg_lab_results")
    .update({ rating: params.rating })
    .eq("id", params.resultId)
    .select("rating")
    .maybeSingle();
  if (error) throw new Error(`updateBgLabResultRating: ${error.message}`);
  if (!data) throw new Error("Result not found");
  const rating = data.rating as string | null;
  if (rating === "up" || rating === "down") return rating;
  return null;
}

export async function updateBgLabResultCost(params: {
  runId: string;
  modelId: string;
  costUsd: number | null;
  costUnitPrice: number | null;
  costUnits: number | null;
  costCurrency: string | null;
  costSource: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bg_lab_results")
    .update({
      cost_usd: params.costUsd,
      cost_unit_price: params.costUnitPrice,
      cost_units: params.costUnits,
      cost_currency: params.costCurrency ?? "USD",
      cost_source: params.costSource,
    })
    .eq("run_id", params.runId)
    .eq("model_id", params.modelId);
  if (error) throw new Error(`updateBgLabResultCost: ${error.message}`);
}

export async function uploadBgLabImage(params: {
  runId: string;
  modelId: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<string> {
  const path = `bg-lab/${params.runId}/${params.modelId}.png`;
  try {
    await uploadPhotoObject({
      path,
      bytes: params.bytes,
      contentType: params.contentType ?? "image/png",
      upsert: true,
    });
  } catch (err) {
    throw new Error(
      `uploadBgLabImage: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return path;
}

/** EXIF-baked source JPEG shared by every model in a lab run. */
export async function uploadBgLabOrientedSource(params: {
  runId: string;
  bytes: Buffer;
}): Promise<{ storagePath: string; signedUrl: string }> {
  const storagePath = `bg-lab/${params.runId}/_source.jpg`;
  try {
    await uploadPhotoObject({
      path: storagePath,
      bytes: params.bytes,
      contentType: "image/jpeg",
      upsert: true,
    });
  } catch (err) {
    throw new Error(
      `uploadBgLabOrientedSource: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const signedUrl = await getSignedPhotoUrl(storagePath, 3600);
  if (!signedUrl) {
    throw new Error("uploadBgLabOrientedSource sign: no url");
  }
  return { storagePath, signedUrl };
}

export async function listBgLabRunsForPhoto(
  photoId: string,
  limit = 10
): Promise<BgLabRunRow[]> {
  const supabase = createAdminClient();
  const { data: runs, error } = await supabase
    .from("bg_lab_runs")
    .select("*")
    .eq("listing_photo_id", photoId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listBgLabRunsForPhoto: ${error.message}`);

  const runRows = runs ?? [];
  if (runRows.length === 0) return [];

  const runIds = runRows.map((r) => r.id as string);
  const { data: results, error: resultsError } = await supabase
    .from("bg_lab_results")
    .select("*")
    .in("run_id", runIds)
    .order("created_at", { ascending: true });
  if (resultsError) {
    throw new Error(`listBgLabRunsForPhoto results: ${resultsError.message}`);
  }

  const byRun = new Map<string, BgLabResultRow[]>();
  const storagePaths = (results ?? [])
    .map((raw) => (raw.storage_path as string | null) ?? null)
    .filter((p): p is string => Boolean(p));
  const signedByPath = await getSignedPhotoUrls(storagePaths);

  for (const raw of results ?? []) {
    const runId = raw.run_id as string;
    const storagePath = (raw.storage_path as string | null) ?? null;
    const imageUrl = storagePath
      ? (signedByPath.get(storagePath) ?? null)
      : null;
    const row: BgLabResultRow = {
      id: raw.id as string,
      run_id: runId,
      model_id: raw.model_id as string,
      model_label: raw.model_label as string,
      provider: raw.provider as "fal" | "photoroom",
      ok: Boolean(raw.ok),
      ms: Number(raw.ms ?? 0),
      storage_path: storagePath,
      fal_request_id: (raw.fal_request_id as string | null) ?? null,
      fal_endpoint: (raw.fal_endpoint as string | null) ?? null,
      cost_usd:
        raw.cost_usd == null ? null : Number(raw.cost_usd),
      cost_unit_price:
        raw.cost_unit_price == null ? null : Number(raw.cost_unit_price),
      cost_units:
        raw.cost_units == null ? null : Number(raw.cost_units),
      cost_currency: (raw.cost_currency as string | null) ?? "USD",
      cost_source: (raw.cost_source as string | null) ?? null,
      error: (raw.error as string | null) ?? null,
      rating:
        raw.rating === "up" || raw.rating === "down"
          ? (raw.rating as BgLabResultRating)
          : null,
      created_at: raw.created_at as string,
      imageUrl,
      dashboardUrl: dashboardUrlFor(
        (raw.fal_request_id as string | null) ?? null,
        (raw.fal_endpoint as string | null) ?? null
      ),
    };
    const list = byRun.get(runId) ?? [];
    list.push(row);
    byRun.set(runId, list);
  }

  return runRows.map((r) => ({
    id: r.id as string,
    listing_photo_id: r.listing_photo_id as string,
    listing_id: r.listing_id as string,
    run_by_user_id: (r.run_by_user_id as string | null) ?? null,
    composite_white: Boolean(r.composite_white),
    source_storage_path: (r.source_storage_path as string | null) ?? null,
    created_at: r.created_at as string,
    results: byRun.get(r.id as string) ?? [],
  }));
}

/**
 * Successful AI outputs for this photo row that were generated from the
 * current original file (same storage_path / crop).
 */
export async function listBgLabResultsForPhotoSource(params: {
  photoId: string;
  sourceStoragePath: string;
  limit?: number;
}): Promise<BgLabResultRow[]> {
  const runs = await listBgLabRunsForPhoto(params.photoId, params.limit ?? 40);
  const matched = runs.filter(
    (run) => run.source_storage_path === params.sourceStoragePath
  );
  const results: BgLabResultRow[] = [];
  for (const run of matched) {
    for (const result of run.results) {
      if (result.ok && result.storage_path && result.imageUrl) {
        results.push(result);
      }
    }
  }
  // Newest first
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return results;
}

export async function getBgLabResultById(
  resultId: string
): Promise<
  | (BgLabResultRow & {
      listing_photo_id: string;
      listing_id: string;
      source_storage_path: string | null;
      composite_white: boolean;
    })
  | null
> {
  const supabase = createAdminClient();
  const { data: raw, error } = await supabase
    .from("bg_lab_results")
    .select(
      "*, bg_lab_runs!inner(listing_photo_id, listing_id, source_storage_path, composite_white)"
    )
    .eq("id", resultId)
    .maybeSingle();
  if (error) throw new Error(`getBgLabResultById: ${error.message}`);
  if (!raw) return null;

  const run = raw.bg_lab_runs as {
    listing_photo_id: string;
    listing_id: string;
    source_storage_path: string | null;
    composite_white: boolean;
  };
  const storagePath = (raw.storage_path as string | null) ?? null;
  const signed = storagePath
    ? await getSignedPhotoUrls([storagePath])
    : new Map<string, string>();

  return {
    id: raw.id as string,
    run_id: raw.run_id as string,
    model_id: raw.model_id as string,
    model_label: raw.model_label as string,
    provider: raw.provider as "fal" | "photoroom",
    ok: Boolean(raw.ok),
    ms: Number(raw.ms ?? 0),
    storage_path: storagePath,
    fal_request_id: (raw.fal_request_id as string | null) ?? null,
    fal_endpoint: (raw.fal_endpoint as string | null) ?? null,
    cost_usd: raw.cost_usd == null ? null : Number(raw.cost_usd),
    cost_unit_price:
      raw.cost_unit_price == null ? null : Number(raw.cost_unit_price),
    cost_units: raw.cost_units == null ? null : Number(raw.cost_units),
    cost_currency: (raw.cost_currency as string | null) ?? "USD",
    cost_source: (raw.cost_source as string | null) ?? null,
    error: (raw.error as string | null) ?? null,
    rating:
      raw.rating === "up" || raw.rating === "down"
        ? (raw.rating as BgLabResultRating)
        : null,
    created_at: raw.created_at as string,
    imageUrl: storagePath ? (signed.get(storagePath) ?? null) : null,
    dashboardUrl: dashboardUrlFor(
      (raw.fal_request_id as string | null) ?? null,
      (raw.fal_endpoint as string | null) ?? null
    ),
    listing_photo_id: run.listing_photo_id,
    listing_id: run.listing_id,
    source_storage_path: run.source_storage_path,
    composite_white: Boolean(run.composite_white),
  };
}

export type BgLabRecentRunSummary = {
  id: string;
  created_at: string;
  listing_photo_id: string;
  listing_id: string;
  run_by_user_id: string | null;
  composite_white: boolean;
  photo_role: string | null;
  listing_title: string | null;
  listing_platform: string | null;
  result_count: number;
  ok_count: number;
  model_labels: string[];
  thumbUrl: string | null;
};

export type BgLabModelCostAvg = {
  modelId: string;
  avgUsd: number;
  sampleCount: number;
};

export type BgLabModelRatingStats = {
  modelId: string;
  upCount: number;
  downCount: number;
};

/**
 * Running average cost_usd per model from successful lab results
 * (optionally scoped to one admin's runs).
 */
export async function listBgLabModelCostAverages(opts?: {
  userId?: string | null;
}): Promise<BgLabModelCostAvg[]> {
  const supabase = createAdminClient();

  let runIds: string[] | null = null;
  if (opts?.userId) {
    const { data: runs, error: runsError } = await supabase
      .from("bg_lab_runs")
      .select("id")
      .eq("run_by_user_id", opts.userId);
    if (runsError) {
      throw new Error(`listBgLabModelCostAverages runs: ${runsError.message}`);
    }
    runIds = (runs ?? []).map((r) => r.id as string);
    if (runIds.length === 0) return [];
  }

  let query = supabase
    .from("bg_lab_results")
    .select("model_id, cost_usd")
    .eq("ok", true)
    .not("cost_usd", "is", null)
    .limit(5000);

  if (runIds) {
    query = query.in("run_id", runIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listBgLabModelCostAverages: ${error.message}`);

  const sums = new Map<string, { sum: number; count: number }>();
  for (const raw of data ?? []) {
    const modelId = raw.model_id as string;
    const cost = Number(raw.cost_usd);
    if (!modelId || !Number.isFinite(cost)) continue;
    const cur = sums.get(modelId) ?? { sum: 0, count: 0 };
    cur.sum += cost;
    cur.count += 1;
    sums.set(modelId, cur);
  }

  return [...sums.entries()]
    .map(([modelId, { sum, count }]) => ({
      modelId,
      avgUsd: sum / count,
      sampleCount: count,
    }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

/** Thumbs-up / thumbs-down totals per model across all lab results. */
export async function listBgLabModelRatingStats(opts?: {
  /** When set, only count ratings from this admin's runs. Omit for global totals. */
  userId?: string | null;
}): Promise<BgLabModelRatingStats[]> {
  const supabase = createAdminClient();

  let runIds: string[] | null = null;
  if (opts?.userId) {
    const { data: runs, error: runsError } = await supabase
      .from("bg_lab_runs")
      .select("id")
      .eq("run_by_user_id", opts.userId);
    if (runsError) {
      throw new Error(`listBgLabModelRatingStats runs: ${runsError.message}`);
    }
    runIds = (runs ?? []).map((r) => r.id as string);
    if (runIds.length === 0) return [];
  }

  let query = supabase
    .from("bg_lab_results")
    .select("model_id, rating")
    .not("rating", "is", null)
    .limit(5000);

  if (runIds) {
    query = query.in("run_id", runIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listBgLabModelRatingStats: ${error.message}`);

  const counts = new Map<string, { upCount: number; downCount: number }>();
  for (const raw of data ?? []) {
    const modelId = raw.model_id as string;
    const rating = raw.rating as string | null;
    if (!modelId || (rating !== "up" && rating !== "down")) continue;
    const cur = counts.get(modelId) ?? { upCount: 0, downCount: 0 };
    if (rating === "up") cur.upCount += 1;
    else cur.downCount += 1;
    counts.set(modelId, cur);
  }

  return [...counts.entries()]
    .map(([modelId, stats]) => ({ modelId, ...stats }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

/** Recent lab runs (optionally for one admin user), newest first. */
export async function listRecentBgLabRuns(opts?: {
  userId?: string | null;
  limit?: number;
}): Promise<BgLabRecentRunSummary[]> {
  const supabase = createAdminClient();
  const limit = opts?.limit ?? 40;

  let query = supabase
    .from("bg_lab_runs")
    .select(
      "id, created_at, listing_photo_id, listing_id, run_by_user_id, composite_white"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.userId) {
    query = query.eq("run_by_user_id", opts.userId);
  }

  const { data: runs, error } = await query;
  if (error) throw new Error(`listRecentBgLabRuns: ${error.message}`);
  const runRows = runs ?? [];
  if (runRows.length === 0) return [];

  const runIds = runRows.map((r) => r.id as string);
  const photoIds = [...new Set(runRows.map((r) => r.listing_photo_id as string))];
  const listingIds = [...new Set(runRows.map((r) => r.listing_id as string))];

  const [{ data: results }, { data: photos }, { data: listings }] =
    await Promise.all([
      supabase
        .from("bg_lab_results")
        .select("run_id, model_label, ok, storage_path, created_at")
        .in("run_id", runIds)
        .order("created_at", { ascending: true }),
      supabase.from("listing_photos").select("id, role").in("id", photoIds),
      supabase
        .from("listings")
        .select("id, title, platform")
        .in("id", listingIds),
    ]);

  const photoById = new Map(
    (photos ?? []).map((p) => [p.id as string, p] as const)
  );
  const listingById = new Map(
    (listings ?? []).map((l) => [l.id as string, l] as const)
  );
  const resultsByRun = new Map<
    string,
    Array<{
      model_label: string;
      ok: boolean;
      storage_path: string | null;
    }>
  >();

  for (const raw of results ?? []) {
    const runId = raw.run_id as string;
    const list = resultsByRun.get(runId) ?? [];
    list.push({
      model_label: raw.model_label as string,
      ok: Boolean(raw.ok),
      storage_path: (raw.storage_path as string | null) ?? null,
    });
    resultsByRun.set(runId, list);
  }

  const summaries: BgLabRecentRunSummary[] = [];
  const thumbPaths: string[] = [];
  for (const run of runRows) {
    const runId = run.id as string;
    const runResults = resultsByRun.get(runId) ?? [];
    const thumbPath =
      runResults.find((r) => r.ok && r.storage_path)?.storage_path ?? null;
    if (thumbPath) thumbPaths.push(thumbPath);
  }
  const signedThumbs = await getSignedPhotoUrls(thumbPaths);

  for (const run of runRows) {
    const runId = run.id as string;
    const runResults = resultsByRun.get(runId) ?? [];
    const photo = photoById.get(run.listing_photo_id as string);
    const listing = listingById.get(run.listing_id as string);
    const thumbPath =
      runResults.find((r) => r.ok && r.storage_path)?.storage_path ?? null;
    summaries.push({
      id: runId,
      created_at: run.created_at as string,
      listing_photo_id: run.listing_photo_id as string,
      listing_id: run.listing_id as string,
      run_by_user_id: (run.run_by_user_id as string | null) ?? null,
      composite_white: Boolean(run.composite_white),
      photo_role: (photo?.role as string | null) ?? null,
      listing_title: (listing?.title as string | null) ?? null,
      listing_platform: (listing?.platform as string | null) ?? null,
      result_count: runResults.length,
      ok_count: runResults.filter((r) => r.ok).length,
      model_labels: runResults.map((r) => r.model_label),
      thumbUrl: thumbPath ? (signedThumbs.get(thumbPath) ?? null) : null,
    });
  }

  return summaries;
}

/** Count of saved AI output images (ok + storage) per listing photo. */
export async function countBgLabSavedResultsByPhotoIds(
  photoIds: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(photoIds.filter(Boolean))];
  const counts: Record<string, number> = {};
  for (const id of unique) counts[id] = 0;
  if (unique.length === 0) return counts;

  const supabase = createAdminClient();
  const { data: runs, error: runsError } = await supabase
    .from("bg_lab_runs")
    .select("id, listing_photo_id")
    .in("listing_photo_id", unique);
  if (runsError) {
    throw new Error(`countBgLabSavedResultsByPhotoIds runs: ${runsError.message}`);
  }

  const runRows = runs ?? [];
  if (runRows.length === 0) return counts;

  const photoByRunId = new Map<string, string>();
  for (const run of runRows) {
    photoByRunId.set(
      run.id as string,
      run.listing_photo_id as string,
    );
  }

  const runIds = [...photoByRunId.keys()];
  const { data: results, error: resultsError } = await supabase
    .from("bg_lab_results")
    .select("run_id")
    .in("run_id", runIds)
    .eq("ok", true)
    .not("storage_path", "is", null);
  if (resultsError) {
    throw new Error(
      `countBgLabSavedResultsByPhotoIds results: ${resultsError.message}`,
    );
  }

  for (const row of results ?? []) {
    const photoId = photoByRunId.get(row.run_id as string);
    if (!photoId) continue;
    counts[photoId] = (counts[photoId] ?? 0) + 1;
  }

  return counts;
}
