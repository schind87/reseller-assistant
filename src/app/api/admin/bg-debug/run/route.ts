import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  buildFalInput,
  extractFalImageUrl,
  FAL_BG_MODELS,
  getFalBgModel,
  type FalBgModelId,
} from "@/lib/ai/fal-bg-models";
import {
  falDashboardUrl,
  falQueueInfer,
  formatCostUsd,
  resolveFalCost,
} from "@/lib/ai/fal-lab";
import { bakeExifOrientation } from "@/lib/image-orient";
import { getAdminPhotoById } from "@/lib/supabase/admin-queries";
import {
  createBgLabRun,
  countBgLabSavedResultsByPhotoIds,
  insertBgLabResult,
  listBgLabModelCostAverages,
  listBgLabModelRatingStats,
  listBgLabRunsForPhoto,
  listRecentBgLabRuns,
  updateBgLabResultCost,
  uploadBgLabImage,
  uploadBgLabOrientedSource,
} from "@/lib/supabase/bg-lab";
import { isIdentifyPhotoRole, type PhotoRole } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type RunBody = {
  photoId?: string;
  modelIds?: string[];
  /** Re-fetch fal billing for saved results that are missing actual cost. */
  refreshCosts?: boolean;
};

type ModelRunResult = {
  id?: string;
  modelId: string;
  label: string;
  provider: "fal";
  ok: boolean;
  ms: number;
  imageUrl: string | null;
  error?: string;
  falRequestId?: string | null;
  falEndpoint?: string | null;
  falDashboardUrl?: string | null;
  costUsd?: number | null;
  costUnitPrice?: number | null;
  costUnits?: number | null;
  costCurrency?: string | null;
  costSource?: string | null;
  storagePath?: string | null;
};

function falKey(): string | null {
  return process.env.FAL_KEY?.trim() || null;
}

function bufferToDataUrl(buf: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function costSourceFromBilling(
  source: "billing_event" | "pricing_estimate" | null
): string | null {
  if (source === "billing_event") return "billing";
  if (source === "pricing_estimate") return "estimate";
  return null;
}

function applyBillingToResult(
  result: ModelRunResult,
  billing: Awaited<ReturnType<typeof resolveFalCost>>
): ModelRunResult {
  return {
    ...result,
    costUsd: billing.costUsd,
    costUnitPrice: billing.unitPrice,
    costUnits: billing.units,
    costCurrency: billing.currency,
    costSource: costSourceFromBilling(billing.source),
    falDashboardUrl: billing.dashboardUrl,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const photoId = url.searchParams.get("photoId")?.trim();
  const wantRecent = url.searchParams.get("recent") === "1";
  const savedCountPhotoIds = url.searchParams
    .get("photoIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (savedCountPhotoIds && savedCountPhotoIds.length > 0) {
    try {
      const counts = await countBgLabSavedResultsByPhotoIds(savedCountPhotoIds);
      return NextResponse.json({ counts });
    } catch (err) {
      console.error("admin bg-debug saved counts error:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Could not load saved counts",
        },
        { status: 500 },
      );
    }
  }

  if (!photoId) {
    const [recentRuns, modelCostAverages, modelRatingStats] = wantRecent
      ? await Promise.all([
          listRecentBgLabRuns({
            userId: auth.user.id,
            limit: 24,
          }),
          listBgLabModelCostAverages({ userId: auth.user.id }),
          listBgLabModelRatingStats(),
        ])
      : [[], [], []];
    return NextResponse.json({
      models: FAL_BG_MODELS,
      hasFalKey: Boolean(falKey()),
      recentRuns: recentRuns
        .filter((run) => {
          const role = run.photo_role as PhotoRole | null;
          return !role || !isIdentifyPhotoRole(role);
        })
        .map((run) => ({
        id: run.id,
        createdAt: run.created_at,
        photoId: run.listing_photo_id,
        listingId: run.listing_id,
        photoRole: run.photo_role,
        listingTitle: run.listing_title,
        listingPlatform: run.listing_platform,
        resultCount: run.result_count,
        okCount: run.ok_count,
        modelLabels: run.model_labels,
        thumbUrl: run.thumbUrl,
      })),
      modelCostAverages: modelCostAverages.map((row) => ({
        modelId: row.modelId,
        avgUsd: row.avgUsd,
        sampleCount: row.sampleCount,
      })),
      modelRatingStats: modelRatingStats.map((row) => ({
        modelId: row.modelId,
        upCount: row.upCount,
        downCount: row.downCount,
      })),
    });
  }

  // Photo history only — recent-run thumbs are loaded separately so switching
  // photos does not re-sign dozens of thumbnail URLs every time.
  const runs = await listBgLabRunsForPhoto(photoId, 20);
  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      createdAt: run.created_at,
      compositeWhite: run.composite_white,
      results: run.results.map((r) => ({
        id: r.id,
        runId: r.run_id,
        modelId: r.model_id,
        label: r.model_label,
        provider: r.provider,
        ok: r.ok,
        ms: r.ms,
        imageUrl: r.imageUrl,
        error: r.error ?? undefined,
        falRequestId: r.fal_request_id,
        falEndpoint: r.fal_endpoint,
        falDashboardUrl: r.dashboardUrl,
        costUsd: r.cost_usd,
        costUnitPrice: r.cost_unit_price,
        costUnits: r.cost_units,
        costCurrency: r.cost_currency,
        costSource: r.cost_source,
        storagePath: r.storage_path,
        costLabel: formatCostUsd(r.cost_usd),
        rating: r.rating,
        createdAt: r.created_at,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: RunBody;
  try {
    body = (await request.json()) as RunBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const photoId = body.photoId?.trim();
  const modelIds = Array.isArray(body.modelIds) ? body.modelIds : [];
  // Lab always keeps transparent / native model output — backdrop is display-only.

  if (!photoId) {
    return NextResponse.json({ error: "photoId is required" }, { status: 400 });
  }

  if (body.refreshCosts) {
    try {
      const runs = await listBgLabRunsForPhoto(photoId, 50);
      let updated = 0;
      for (const run of runs) {
        for (const result of run.results) {
          if (
            !result.ok ||
            !result.fal_request_id ||
            !result.fal_endpoint ||
            result.cost_source === "billing"
          ) {
            continue;
          }
          const model = getFalBgModel(result.model_id);
          const billing = await resolveFalCost({
            requestId: result.fal_request_id,
            endpointId: result.fal_endpoint,
            approxCostHint: model?.approxCost,
          });
          if (billing.source !== "billing_event" && billing.costUsd == null) {
            continue;
          }
          if (
            billing.costUsd === result.cost_usd &&
            costSourceFromBilling(billing.source) === result.cost_source
          ) {
            continue;
          }
          await updateBgLabResultCost({
            runId: run.id,
            modelId: result.model_id,
            costUsd: billing.costUsd,
            costUnitPrice: billing.unitPrice,
            costUnits: billing.units,
            costCurrency: billing.currency,
            costSource: costSourceFromBilling(billing.source),
          });
          updated += 1;
        }
      }
      const refreshed = await listBgLabRunsForPhoto(photoId, 50);
      return NextResponse.json({
        updated,
        runs: refreshed.map((run) => ({
          id: run.id,
          createdAt: run.created_at,
          compositeWhite: run.composite_white,
          results: run.results.map((r) => ({
            id: r.id,
            runId: r.run_id,
            modelId: r.model_id,
            label: r.model_label,
            provider: r.provider,
            ok: r.ok,
            ms: r.ms,
            imageUrl: r.imageUrl,
            error: r.error ?? undefined,
            falRequestId: r.fal_request_id,
            falEndpoint: r.fal_endpoint,
            falDashboardUrl: r.dashboardUrl,
            costUsd: r.cost_usd,
            costUnitPrice: r.cost_unit_price,
            costUnits: r.cost_units,
            costCurrency: r.cost_currency,
            costSource: r.cost_source,
            storagePath: r.storage_path,
            costLabel: formatCostUsd(r.cost_usd),
            rating: r.rating,
            createdAt: r.created_at,
          })),
        })),
      });
    } catch (err) {
      console.error("admin bg-debug refresh costs error:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Could not refresh costs",
        },
        { status: 500 },
      );
    }
  }

  if (modelIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one model" },
      { status: 400 },
    );
  }
  if (modelIds.length > 8) {
    return NextResponse.json(
      { error: "Run at most 8 models at once" },
      { status: 400 },
    );
  }

  const photo = await getAdminPhotoById(photoId);
  if (!photo || !photo.signedUrl) {
    return NextResponse.json(
      { error: "Photo not found or unsigned" },
      { status: 404 },
    );
  }
  const photoSignedUrl = photo.signedUrl;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const sourceBytes = await downloadImageBuffer(photoSignedUrl);
        // Bake EXIF so models like Ideogram (which ignore Orientation) stay upright.
        const oriented = await bakeExifOrientation(sourceBytes);
        const width = oriented.width;
        const height = oriented.height;

        const run = await createBgLabRun({
          photoId,
          listingId: photo.listing_id,
          runByUserId: auth.user.id,
          compositeWhite: false,
          sourceStoragePath: photo.storage_path,
        });

        const orientedSource = await uploadBgLabOrientedSource({
          runId: run.id,
          bytes: oriented.buffer,
        });
        const falImageUrl = orientedSource.signedUrl;

        const total = modelIds.length;
        write({
          type: "start",
          runId: run.id,
          total,
          modelIds,
          photo: {
            id: photo.id,
            role: photo.role,
            listingId: photo.listing_id,
            listingTitle: photo.listing_title,
            ownerEmail: photo.owner_email,
            signedUrl: photoSignedUrl,
            processedSignedUrl: photo.processedSignedUrl,
          },
        });

        let completed = 0;

        async function runOneModel(rawId: string): Promise<ModelRunResult> {
          const model = getFalBgModel(rawId);
          const started = Date.now();

          if (!model) {
            return {
              modelId: rawId,
              label: rawId,
              provider: "fal",
              ok: false,
              ms: 0,
              imageUrl: null,
              error: "Unknown model id",
            };
          }

          let ok = false;
          let error: string | undefined;
          let imageUrl: string | null = null;
          let storagePath: string | null = null;
          let falRequestId: string | null = null;
          const falEndpoint: string | null = model.falPath;
          let costUsd: number | null = null;
          let costUnitPrice: number | null = null;
          let costUnits: number | null = null;
          let costCurrency: string | null = "USD";
          let costSource: string | null = null;

          try {
            const { requestId, data } = await falQueueInfer(
              model.falPath,
              buildFalInput(model, falImageUrl, width, height),
            );
            falRequestId = requestId;
            const remoteUrl = extractFalImageUrl(data);
            if (!remoteUrl) {
              throw new Error("No image URL in fal response");
            }
            const outBuf = await downloadImageBuffer(remoteUrl);

            const billing = await resolveFalCost({
              requestId,
              endpointId: model.falPath,
              settleMs: 1200,
              approxCostHint: model.approxCost,
            });
            costUsd = billing.costUsd;
            costUnitPrice = billing.unitPrice;
            costUnits = billing.units;
            costCurrency = billing.currency;
            costSource = costSourceFromBilling(billing.source);

            storagePath = await uploadBgLabImage({
              runId: run.id,
              modelId: model.id,
              bytes: outBuf,
            });
            imageUrl = bufferToDataUrl(outBuf);
            ok = true;
          } catch (err) {
            error = err instanceof Error ? err.message : "Run failed";
          }

          const ms = Date.now() - started;
          const inserted = await insertBgLabResult({
            runId: run.id,
            modelId: model.id,
            modelLabel: model.label,
            provider: model.provider,
            ok,
            ms,
            storagePath,
            falRequestId,
            falEndpoint,
            costUsd,
            costUnitPrice,
            costUnits,
            costCurrency,
            costSource,
            error: error ?? null,
          });

          return {
            id: inserted.id,
            modelId: model.id,
            label: model.label,
            provider: model.provider,
            ok,
            ms,
            imageUrl,
            error,
            falRequestId,
            falEndpoint,
            falDashboardUrl: falRequestId
              ? falDashboardUrl(falRequestId, falEndpoint)
              : falDashboardUrl(null, falEndpoint),
            costUsd,
            costUnitPrice,
            costUnits,
            costCurrency,
            costSource,
            storagePath,
          };
        }

        // Fan out all fal jobs at once; stream each result as it finishes.
        const results = await Promise.all(
          modelIds.map(async (rawId) => {
            const result = await runOneModel(rawId);
            completed += 1;
            write({
              type: "result",
              runId: run.id,
              completed,
              total,
              result: {
                ...result,
                runId: run.id,
                rating: null,
                costLabel: formatCostUsd(result.costUsd ?? null),
                createdAt: new Date().toISOString(),
              },
            });
            return result;
          }),
        );

        // Second pass: upgrade catalog estimates to actual fal billing when ready.
        await Promise.all(
          results.map(async (result, i) => {
            if (
              !result.ok ||
              !result.falRequestId ||
              !result.falEndpoint ||
              result.costSource === "billing"
            ) {
              return;
            }
            try {
              const modelDef = getFalBgModel(result.modelId);
              const billing = await resolveFalCost({
                requestId: result.falRequestId,
                endpointId: result.falEndpoint,
                settleMs: 1500,
                approxCostHint: modelDef?.approxCost,
              });
              if (billing.source !== "billing_event") return;
              const next = applyBillingToResult(result, billing);
              results[i] = next;
              await updateBgLabResultCost({
                runId: run.id,
                modelId: result.modelId,
                costUsd: next.costUsd ?? null,
                costUnitPrice: next.costUnitPrice ?? null,
                costUnits: next.costUnits ?? null,
                costCurrency: next.costCurrency ?? "USD",
                costSource: next.costSource ?? null,
              });
              write({
                type: "cost",
                runId: run.id,
                result: {
                  modelId: next.modelId,
                  costUsd: next.costUsd,
                  costUnitPrice: next.costUnitPrice,
                  costUnits: next.costUnits,
                  costCurrency: next.costCurrency,
                  costSource: next.costSource,
                  falDashboardUrl: next.falDashboardUrl,
                  costLabel: formatCostUsd(next.costUsd ?? null),
                },
              });
            } catch {
              /* keep prior cost */
            }
          }),
        );

        write({ type: "done", runId: run.id, total: results.length });
      } catch (err) {
        console.error("admin bg-debug run error:", err);
        write({
          type: "error",
          error:
            err instanceof Error ? err.message : "Could not run debug models",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Keep type import used for exhaustiveness in clients. */
export type { FalBgModelId };
