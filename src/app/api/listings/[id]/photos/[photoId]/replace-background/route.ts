import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  BG_PIPELINE_TAG,
  isCurrentBgPipeline,
  replaceBackground,
} from "@/lib/ai/background";
import { getFalBgModel, type FalBgModelId } from "@/lib/ai/fal-bg-models";
import { getAdminUser } from "@/lib/admin";
import { PLATFORM_PHOTO_ASPECT } from "@/lib/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createBgLabRun,
  insertBgLabResult,
  uploadBgLabImage,
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

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

/**
 * Opt a listing photo into (or out of) clean background replacement, and
 * optionally run the hanger-safe pipeline immediately.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id, { writeRequiresOwner: true });
  if (access.error) return access.error;

  let body: {
    replaceBackground?: boolean;
    run?: boolean;
    force?: boolean;
    backgroundColor?: string;
    modelId?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  let adminModelId: FalBgModelId | undefined;
  if (typeof body.modelId === "string" && body.modelId.trim()) {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const model = getFalBgModel(body.modelId.trim());
    if (!model) {
      return NextResponse.json(
        { error: "Unknown background model" },
        { status: 400 }
      );
    }
    adminModelId = model.id;
  }

  const photo = await getListingPhoto(id, photoId);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  if (!isPostingPhotoRole(photo.role)) {
    return NextResponse.json(
      {
        error:
          "Clean background is only available for listing photos (not tags or stocking).",
      },
      { status: 400 }
    );
  }

  const wantReplace =
    typeof body.replaceBackground === "boolean"
      ? body.replaceBackground
      : true;
  const runNow = body.run !== false;
  const force = body.force === true || Boolean(adminModelId);

  try {
    let updated = await updatePhoto(photoId, {
      replace_background: wantReplace,
    });

    if (!wantReplace) {
      // Keep the cleaned file in storage so toggling back on is instant.
      // Cover preview falls back to the original until Clean bg is on again.
      if (
        photo.processed_path &&
        access.listing.cover_processed_path === photo.processed_path
      ) {
        await updateListing(id, { cover_processed_path: null });
      }
    } else if (
      runNow &&
      !force &&
      isCurrentBgPipeline(updated.processed_path)
    ) {
      // Reuse the previously cleaned image — no fal.ai call.
      if (updated.role === "cover" && updated.processed_path) {
        await updateListing(id, {
          cover_processed_path: updated.processed_path,
        });
      }
    } else if (runNow) {
      // Always process from the original capture, never the cleaned version.
      const signedUrl = await getSignedPhotoUrl(updated.storage_path);
      if (!signedUrl) {
        return NextResponse.json(
          { error: "Could not read photo for processing" },
          { status: 500 }
        );
      }

      const processed = await replaceBackground(signedUrl, {
        backgroundColor: body.backgroundColor,
        keepHanger: true,
        modelId: adminModelId,
        aspect: PLATFORM_PHOTO_ASPECT[access.listing.platform],
      });

      if (!processed.ok) {
        const message =
          processed.reason === "missing_fal_key"
            ? "Clean background needs FAL_KEY. Add it in Vercel → Settings → Environment Variables, then redeploy."
            : processed.detail ||
              "Background replacement failed. Try again in a moment.";

        // Redo failures keep the previous clean result when one exists.
        if (!(force && photo.processed_path && photo.replace_background)) {
          updated = await updatePhoto(photoId, { replace_background: false });
        } else {
          updated = await updatePhoto(photoId, { replace_background: true });
        }

        return NextResponse.json(
          {
            error: message,
            reason: processed.reason,
            photo: await withUrls(updated),
          },
          { status: processed.reason === "missing_fal_key" ? 503 : 502 }
        );
      }

      const processedPath = `${id}/${updated.role}-${BG_PIPELINE_TAG}-${uuidv4()}.png`;
      const supabase = createAdminClient();
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(processedPath, processed.bytes, {
          contentType: processed.contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error("bg replace upload failed:", uploadError.message);
        return NextResponse.json(
          { error: "Could not store processed photo" },
          { status: 500 }
        );
      }

      if (updated.processed_path && updated.processed_path !== processedPath) {
        await supabase.storage
          .from("listing-photos")
          .remove([updated.processed_path])
          .catch(() => undefined);
      }

      updated = await updatePhoto(photoId, { processed_path: processedPath });
      if (updated.role === "cover") {
        await updateListing(id, { cover_processed_path: processedPath });
      }

      // Persist so later clicks can pick among AI results for this crop.
      try {
        const model = adminModelId ? getFalBgModel(adminModelId) : null;
        const run = await createBgLabRun({
          photoId,
          listingId: id,
          runByUserId: access.userId,
          compositeWhite: true,
          sourceStoragePath: updated.storage_path,
        });
        const labPath = await uploadBgLabImage({
          runId: run.id,
          modelId: model?.id ?? "production-hanger",
          bytes: Buffer.from(processed.bytes),
          contentType: processed.contentType,
        });
        await insertBgLabResult({
          runId: run.id,
          modelId: model?.id ?? "production-hanger",
          modelLabel: model?.label ?? "Production default (hanger-safe)",
          provider: "fal",
          ok: true,
          ms: 0,
          storagePath: labPath,
        });
      } catch (labErr) {
        console.error("replace-background lab record failed:", labErr);
      }
    }

    return NextResponse.json({ photo: await withUrls(updated) });
  } catch (err) {
    console.error("replace-background error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? err.message
            : "Could not update background setting",
      },
      { status: 500 }
    );
  }
}

async function withUrls(
  photo: Awaited<ReturnType<typeof updatePhoto>>
): Promise<ListingPhotoWithUrl> {
  const [withUrl] = await withSignedPhotoUrls([photo]);
  return withUrl;
}
