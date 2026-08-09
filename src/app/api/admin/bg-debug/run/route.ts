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
import { getAdminPhotoById } from "@/lib/supabase/admin-queries";

export const maxDuration = 120;

type RunBody = {
  photoId?: string;
  modelIds?: string[];
  /** Composite transparent results onto white for easier comparison. */
  compositeWhite?: boolean;
};

type ModelRunResult = {
  modelId: string;
  label: string;
  provider: "fal" | "photoroom";
  ok: boolean;
  ms: number;
  imageUrl: string | null;
  error?: string;
};

function falKey(): string | null {
  return process.env.FAL_KEY?.trim() || null;
}

function photoroomKey(): string | null {
  return process.env.PHOTOROOM_API_KEY?.trim() || null;
}

async function falRun(
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY is not configured");

  const response = await fetch(`https://fal.run/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`fal ${path} ${response.status}: ${text.slice(0, 400)}`);
  }

  return response.json();
}

async function runPhotoroom(imageUrl: string): Promise<string> {
  const key = photoroomKey();
  if (!key) throw new Error("PHOTOROOM_API_KEY is not configured");

  const source = await fetch(imageUrl);
  if (!source.ok) throw new Error("Could not download source photo");
  const bytes = await source.arrayBuffer();
  const contentType = source.headers.get("content-type") ?? "image/jpeg";

  const form = new FormData();
  form.append(
    "image_file",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    "photo.jpg"
  );
  form.append("format", "png");
  form.append("bg_color", "FFFFFF");
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
    throw new Error(`photoroom ${response.status}: ${text.slice(0, 400)}`);
  }

  // Return as data URI so the admin UI can display without a second store.
  const out = Buffer.from(await response.arrayBuffer());
  return `data:image/png;base64,${out.toString("base64")}`;
}

async function maybeCompositeWhite(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) return imageUrl;
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  if (!meta.hasAlpha || !meta.width || !meta.height) {
    // Already opaque / no alpha — return original URL.
    return imageUrl;
  }

  const composed = await sharp({
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

  return `data:image/png;base64,${composed.toString("base64")}`;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return NextResponse.json({
    models: FAL_BG_MODELS,
    hasFalKey: Boolean(falKey()),
    hasPhotoroomKey: Boolean(photoroomKey()),
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
      { status: 400 }
    );
  }
  if (modelIds.length > 8) {
    return NextResponse.json(
      { error: "Run at most 8 models at once" },
      { status: 400 }
    );
  }

  try {
    const photo = await getAdminPhotoById(photoId);
    if (!photo || !photo.signedUrl) {
      return NextResponse.json(
        { error: "Photo not found or unsigned" },
        { status: 404 }
      );
    }

    const sourceMeta = await sharp(
      Buffer.from(await (await fetch(photo.signedUrl)).arrayBuffer())
    ).metadata();
    const width = sourceMeta.width ?? 1024;
    const height = sourceMeta.height ?? 1024;

    const results: ModelRunResult[] = await Promise.all(
      modelIds.map(async (rawId) => {
        const model = getFalBgModel(rawId);
        const started = Date.now();
        if (!model) {
          return {
            modelId: rawId,
            label: rawId,
            provider: "fal" as const,
            ok: false,
            ms: 0,
            imageUrl: null,
            error: "Unknown model id",
          };
        }

        try {
          let imageUrl: string | null = null;

          if (model.provider === "photoroom") {
            imageUrl = await runPhotoroom(photo.signedUrl!);
          } else {
            if (!model.falPath) {
              throw new Error("Model missing fal path");
            }
            const payload = await falRun(
              model.falPath,
              buildFalInput(model, photo.signedUrl!, width, height)
            );
            imageUrl = extractFalImageUrl(payload);
            if (!imageUrl) {
              throw new Error("No image URL in fal response");
            }
            if (compositeWhite && !model.solidBackground) {
              imageUrl = await maybeCompositeWhite(imageUrl);
            }
          }

          return {
            modelId: model.id,
            label: model.label,
            provider: model.provider,
            ok: true,
            ms: Date.now() - started,
            imageUrl,
          };
        } catch (err) {
          return {
            modelId: model.id,
            label: model.label,
            provider: model.provider,
            ok: false,
            ms: Date.now() - started,
            imageUrl: null,
            error: err instanceof Error ? err.message : "Run failed",
          };
        }
      })
    );

    return NextResponse.json({
      photo: {
        id: photo.id,
        role: photo.role,
        listingId: photo.listing_id,
        listingTitle: photo.listing_title,
        ownerEmail: photo.owner_email,
        signedUrl: photo.signedUrl,
        processedSignedUrl: photo.processedSignedUrl,
      },
      results,
    });
  } catch (err) {
    console.error("admin bg-debug run error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not run debug models",
      },
      { status: 500 }
    );
  }
}

/** Keep type import used for exhaustiveness in clients. */
export type { FalBgModelId };
