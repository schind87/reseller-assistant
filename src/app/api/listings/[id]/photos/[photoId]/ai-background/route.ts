import { NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { BG_PIPELINE_TAG } from "@/lib/ai/background";
import { authorizeListingAccess } from "@/lib/listing-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBgLabResultById,
  listBgLabModelRatingStats,
  listBgLabResultsForPhotoSource,
} from "@/lib/supabase/bg-lab";
import {
  getListingPhoto,
  getSignedPhotoUrl,
  updateListing,
  updatePhoto,
  withSignedPhotoUrls,
} from "@/lib/supabase/queries";
import { isPostingPhotoRole, type ListingPhotoWithUrl } from "@/lib/types";

export const maxDuration = 120;
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

/**
 * List AI background results for the current crop of a listing photo.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  const photo = await getListingPhoto(id, photoId);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if (!isPostingPhotoRole(photo.role)) {
    return NextResponse.json(
      { error: "AI background is only for listing photos." },
      { status: 400 }
    );
  }

  try {
    const [results, ratingStats, originalUrl] = await Promise.all([
      listBgLabResultsForPhotoSource({
        photoId,
        sourceStoragePath: photo.storage_path,
      }),
      listBgLabModelRatingStats(),
      getSignedPhotoUrl(photo.storage_path),
    ]);

    const totals = new Map(
      ratingStats.map((row) => [
        row.modelId,
        { upCount: row.upCount, downCount: row.downCount },
      ])
    );

    return NextResponse.json({
      photoId: photo.id,
      sourceStoragePath: photo.storage_path,
      replaceBackground: photo.replace_background,
      originalUrl,
      results: results.map((result) => {
        const modelTotals = totals.get(result.model_id);
        return {
          id: result.id,
          modelId: result.model_id,
          modelLabel: result.model_label,
          imageUrl: result.imageUrl,
          rating: result.rating,
          createdAt: result.created_at,
          modelUpCount: modelTotals?.upCount ?? 0,
          modelDownCount: modelTotals?.downCount ?? 0,
        };
      }),
    });
  } catch (err) {
    console.error("ai-background GET error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not load AI results",
      },
      { status: 500 }
    );
  }
}

/**
 * Apply a prior AI result to the listing photo (sets clean background on).
 */
export async function POST(request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id, { writeRequiresOwner: true });
  if (access.error) return access.error;

  let body: { resultId?: string; restore?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const photo = await getListingPhoto(id, photoId);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if (!isPostingPhotoRole(photo.role)) {
    return NextResponse.json(
      { error: "AI background is only for listing photos." },
      { status: 400 }
    );
  }

  if (body.restore === true) {
    try {
      let updated = await updatePhoto(photoId, { replace_background: false });
      if (
        photo.processed_path &&
        access.listing.cover_processed_path === photo.processed_path
      ) {
        await updateListing(id, { cover_processed_path: null });
      }
      const [withUrl] = await withSignedPhotoUrls([updated]);
      return NextResponse.json({ photo: withUrl as ListingPhotoWithUrl });
    } catch (err) {
      console.error("ai-background restore error:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Could not restore original",
        },
        { status: 500 }
      );
    }
  }

  const resultId = body.resultId?.trim();
  if (!resultId) {
    return NextResponse.json(
      { error: "Choose an AI result to apply." },
      { status: 400 }
    );
  }

  try {
    const result = await getBgLabResultById(resultId);
    if (
      !result ||
      !result.ok ||
      !result.storage_path ||
      result.listing_photo_id !== photoId ||
      result.listing_id !== id
    ) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }
    if (result.source_storage_path !== photo.storage_path) {
      return NextResponse.json(
        {
          error:
            "That AI result is from a previous crop of this photo. Run AI again on the current photo.",
        },
        { status: 409 }
      );
    }

    const supabase = createAdminClient();
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from("listing-photos")
      .download(result.storage_path);
    if (downloadError || !downloaded) {
      return NextResponse.json(
        { error: "Could not read AI result image" },
        { status: 500 }
      );
    }

    const rawBytes = Buffer.from(await downloaded.arrayBuffer());
    const listingReady = await ensureWhiteBackgroundPng(rawBytes);

    const processedPath = `${id}/${photo.role}-${BG_PIPELINE_TAG}-${uuidv4()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(processedPath, listingReady, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) {
      return NextResponse.json(
        { error: "Could not store processed photo" },
        { status: 500 }
      );
    }

    if (photo.processed_path && photo.processed_path !== processedPath) {
      await supabase.storage
        .from("listing-photos")
        .remove([photo.processed_path])
        .catch(() => undefined);
    }

    const updated = await updatePhoto(photoId, {
      replace_background: true,
      processed_path: processedPath,
    });
    if (updated.role === "cover") {
      await updateListing(id, { cover_processed_path: processedPath });
    }

    const [withUrl] = await withSignedPhotoUrls([updated]);
    return NextResponse.json({ photo: withUrl as ListingPhotoWithUrl });
  } catch (err) {
    console.error("ai-background apply error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not apply AI result",
      },
      { status: 500 }
    );
  }
}

/** Lab cutouts are often transparent — listing photos need a white studio plate. */
async function ensureWhiteBackgroundPng(input: Buffer): Promise<Buffer> {
  const image = sharp(input).ensureAlpha();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    return image.png().toBuffer();
  }

  const hasAlpha = meta.hasAlpha === true;
  if (!hasAlpha) {
    return image.png().toBuffer();
  }

  const cutout = await image.png().toBuffer();
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: cutout, blend: "over" }])
    .png()
    .toBuffer();
}
