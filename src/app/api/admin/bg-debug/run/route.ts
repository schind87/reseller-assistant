import { NextResponse } from "next/server";
import sharp from "sharp";
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
  resolveFalCost,
} from "@/lib/ai/fal-lab";
import { getAdminPhotoById } from "@/lib/supabase/admin-queries";
import {
  createBgLabRun,
  insertBgLabResult,
  listBgLabRunsForPhoto,
  uploadBgLabImage,
} from "@/lib/supabase/bg-lab";

export const runtime = "nodejs";
export const maxDuration = 300;

type RunBody = {
  photoId?: string;
  modelIds?: string[];
  /** Composite transparent results onto white for easier comparison. */
  compositeWhite?: boolean;
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

async function maybeCompositeWhiteBuffer(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  if (!meta.hasAlpha || !meta.width || !meta.height) {
    return buf;
  }

  return sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: await sharp(buf).png().toBuffer(), blend: "over" }])
    .png()
    .toBuffer();
}

function formatCostUsd(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(5)}`;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const photoId = new URL(request.url).searchParams.get("photoId")?.trim();
  if (!photoId) {
    return NextResponse.json({
      models: FAL_BG_MODELS,
      hasFalKey: Boolean(falKey()),
    });
  }

  const runs = await listBgLabRunsForPhoto(photoId, 20);
  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      createdAt: run.created_at,
      compositeWhite: run.composite_white,
      results: run.results.map((r) => ({
        id: r.id,
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
  const compositeWhite = body.compositeWhite !== false;

  if (!photoId) {
    return NextResponse.json({ error: "photoId is required" }, { status: 400 });
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

  try {
    const photo = await getAdminPhotoById(photoId);
    if (!photo || !photo.signedUrl) {
      return NextResponse.json(
        { error: "Photo not found or unsigned" },
        { status: 404 },
      );
    }

    const sourceBytes = await downloadImageBuffer(photo.signedUrl);
    const sourceMeta = await sharp(sourceBytes).metadata();
    const width = sourceMeta.width ?? 1024;
    const height = sourceMeta.height ?? 1024;

    const run = await createBgLabRun({
      photoId,
      listingId: photo.listing_id,
      runByUserId: auth.user.id,
      compositeWhite,
    });

    const results: ModelRunResult[] = [];

    for (const rawId of modelIds) {
      const model = getFalBgModel(rawId);
      const started = Date.now();

      if (!model) {
        results.push({
          modelId: rawId,
          label: rawId,
          provider: "fal",
          ok: false,
          ms: 0,
          imageUrl: null,
          error: "Unknown model id",
        });
        continue;
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
          buildFalInput(model, photo.signedUrl, width, height),
        );
        falRequestId = requestId;
        const remoteUrl = extractFalImageUrl(data);
        if (!remoteUrl) {
          throw new Error("No image URL in fal response");
        }
        let outBuf = await downloadImageBuffer(remoteUrl);
        if (compositeWhite && !model.solidBackground) {
          outBuf = await maybeCompositeWhiteBuffer(outBuf);
        }

        const billing = await resolveFalCost({
          requestId,
          endpointId: model.falPath,
        });
        costUsd = billing.costUsd;
        costUnitPrice = billing.unitPrice;
        costUnits = billing.units;
        costCurrency = billing.currency;
        costSource =
          billing.source === "billing_event"
            ? "billing"
            : billing.source === "pricing_estimate"
              ? "estimate"
              : null;

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
      await insertBgLabResult({
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

      results.push({
        modelId: model.id,
        label: model.label,
        provider: model.provider,
        ok,
        ms,
        imageUrl,
        error,
        falRequestId,
        falEndpoint,
        falDashboardUrl: falRequestId ? falDashboardUrl(falRequestId) : null,
        costUsd,
        costUnitPrice,
        costUnits,
        costCurrency,
        costSource,
        storagePath,
      });
    }

    return NextResponse.json({
      runId: run.id,
      photo: {
        id: photo.id,
        role: photo.role,
        listingId: photo.listing_id,
        listingTitle: photo.listing_title,
        ownerEmail: photo.owner_email,
        signedUrl: photo.signedUrl,
        processedSignedUrl: photo.processedSignedUrl,
      },
      results: results.map((r) => ({
        ...r,
        costLabel: formatCostUsd(r.costUsd ?? null),
      })),
    });
  } catch (err) {
    console.error("admin bg-debug run error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not run debug models",
      },
      { status: 500 },
    );
  }
}

/** Keep type import used for exhaustiveness in clients. */
export type { FalBgModelId };
