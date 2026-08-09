import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authorizeListingAccess } from "@/lib/listing-access";
import { replaceBackground } from "@/lib/ai/background";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getListingPhoto,
  getSignedPhotoUrl,
  updateListing,
  updatePhoto,
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
    backgroundColor?: string;
  } = {};
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

  try {
    let updated = await updatePhoto(photoId, {
      replace_background: wantReplace,
    });

    if (!wantReplace) {
      // Revert to the original capture when turning the feature off.
      if (updated.processed_path) {
        const supabase = createAdminClient();
        await supabase.storage
          .from("listing-photos")
          .remove([updated.processed_path])
          .catch(() => undefined);
        updated = await updatePhoto(photoId, { processed_path: null });
        if (access.listing.cover_processed_path === photo.processed_path) {
          await updateListing(id, { cover_processed_path: null });
        }
      }
    } else if (runNow) {
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
      });

      if (!processed.ok) {
        // Don't leave the opt-in flag on if processing failed.
        updated = await updatePhoto(photoId, { replace_background: false });
        const message =
          processed.reason === "missing_fal_key"
            ? "Clean background needs FAL_KEY on the server. Add it in Vercel → Settings → Environment Variables, then redeploy."
            : processed.detail ||
              "Background replacement failed. Try again in a moment.";
        return NextResponse.json(
          {
            error: message,
            reason: processed.reason,
            photo: await withUrls(updated),
          },
          { status: processed.reason === "missing_fal_key" ? 503 : 502 }
        );
      }

      const processedPath = `${id}/${updated.role}-bg-${uuidv4()}.png`;
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
  return {
    ...photo,
    signedUrl: await getSignedPhotoUrl(photo.storage_path),
    processedSignedUrl: photo.processed_path
      ? await getSignedPhotoUrl(photo.processed_path)
      : null,
  };
}
