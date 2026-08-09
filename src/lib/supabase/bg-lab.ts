import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/supabase/queries";

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
  created_at: string;
  results: BgLabResultRow[];
};

function dashboardUrlFor(requestId: string | null): string | null {
  if (!requestId) return null;
  return `https://fal.ai/dashboard/requests?requestId=${encodeURIComponent(requestId)}`;
}

export async function createBgLabRun(params: {
  photoId: string;
  listingId: string;
  runByUserId: string | null;
  compositeWhite: boolean;
}): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bg_lab_runs")
    .insert({
      listing_photo_id: params.photoId,
      listing_id: params.listingId,
      run_by_user_id: params.runByUserId,
      composite_white: params.compositeWhite,
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
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bg_lab_results").insert({
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
  });
  if (error) throw new Error(`insertBgLabResult: ${error.message}`);
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
  const supabase = createAdminClient();
  const path = `bg-lab/${params.runId}/${params.modelId}.png`;
  const { error } = await supabase.storage
    .from("listing-photos")
    .upload(path, params.bytes, {
      contentType: params.contentType ?? "image/png",
      upsert: true,
    });
  if (error) throw new Error(`uploadBgLabImage: ${error.message}`);
  return path;
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
  for (const raw of results ?? []) {
    const runId = raw.run_id as string;
    const imageUrl = raw.storage_path
      ? await getSignedPhotoUrl(raw.storage_path as string)
      : null;
    const row: BgLabResultRow = {
      id: raw.id as string,
      run_id: runId,
      model_id: raw.model_id as string,
      model_label: raw.model_label as string,
      provider: raw.provider as "fal" | "photoroom",
      ok: Boolean(raw.ok),
      ms: Number(raw.ms ?? 0),
      storage_path: (raw.storage_path as string | null) ?? null,
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
      created_at: raw.created_at as string,
      imageUrl,
      dashboardUrl: dashboardUrlFor(
        (raw.fal_request_id as string | null) ?? null
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
    created_at: r.created_at as string,
    results: byRun.get(r.id as string) ?? [],
  }));
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
      thumbUrl: thumbPath ? await getSignedPhotoUrl(thumbPath) : null,
    });
  }

  return summaries;
}
