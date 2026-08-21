import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authorizeListingAccess } from "@/lib/listing-access";
import { draftListing } from "@/lib/ai/draft";
import {
  BG_PIPELINE_TAG,
  isCurrentBgPipeline,
  replaceBackground,
} from "@/lib/ai/background";
import { identifyFromPhotos } from "@/lib/ai/identify";
import { PLATFORM_PHOTO_ASPECT } from "@/lib/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getListingWithPhotos,
  getSignedPhotoUrls,
  getWorkspace,
  updateListing,
  updatePhoto,
} from "@/lib/supabase/queries";
import { getProfileById } from "@/lib/auth/otp";
import {
  composeSellerContext,
  composeSmokePetNotes,
  defaultListingPreferences,
} from "@/lib/seller-preferences";
import {
  isIdentifyPhotoRole,
  isPostingPhotoRole,
} from "@/lib/types";

export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id, { writeRequiresOwner: true });
  if (access.error) return access.error;

  try {
    const result = await getListingWithPhotos(id);
    if (!result) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (result.photos.length === 0) {
      return NextResponse.json(
        { error: "Add at least one photo first." },
        { status: 400 }
      );
    }

    await updateListing(id, { status: "processing" });

    const signedByPath = await getSignedPhotoUrls(
      result.photos.map((photo) => photo.storage_path)
    );
    const signedUrls = result.photos
      .map((photo) => ({
        photo,
        url: signedByPath.get(photo.storage_path) ?? null,
      }))
      .filter((p): p is { photo: (typeof result.photos)[number]; url: string } =>
        Boolean(p.url)
      );

    const identifyUrls = signedUrls
      .filter((p) => isIdentifyPhotoRole(p.photo.role))
      .map((p) => p.url);
    const listingUrls = signedUrls
      .filter((p) => isPostingPhotoRole(p.photo.role))
      .map((p) => p.url);
    const draftImageUrls =
      listingUrls.length > 0
        ? listingUrls
        : identifyUrls.length > 0
          ? identifyUrls
          : signedUrls.map((p) => p.url);

    const identified = await identifyFromPhotos(
      identifyUrls.length > 0 ? identifyUrls : draftImageUrls
    );

    const workspace = await getWorkspace();
    const profile = result.listing.user_id
      ? await getProfileById(result.listing.user_id).catch(() => null)
      : null;
    const prefs =
      profile?.listing_preferences ?? defaultListingPreferences();
    const smokePetNotes =
      composeSmokePetNotes(prefs) ||
      workspace.default_smoke_pet_notes ||
      null;

    const draft = await draftListing({
      platform: result.listing.platform,
      identified,
      imageUrls: draftImageUrls,
      smokePetNotes,
      sellerContext: composeSellerContext(prefs),
    });

    let coverProcessedPath: string | null = result.listing.cover_processed_path;

    // Only replace backgrounds on photos the seller opted into.
    const supabase = createAdminClient();
    const bgTargets = signedUrls.filter(
      (p) =>
        p.photo.replace_background && isPostingPhotoRole(p.photo.role)
    );

    for (const entry of bgTargets) {
      // Skip fal when a current-pipeline cleaned version already exists.
      if (isCurrentBgPipeline(entry.photo.processed_path)) {
        if (entry.photo.role === "cover" && entry.photo.processed_path) {
          coverProcessedPath = entry.photo.processed_path;
        }
        continue;
      }

      const downloaded = await replaceBackground(entry.url, {
        keepHanger: true,
        aspect: PLATFORM_PHOTO_ASPECT[result.listing.platform],
      });
      if (!downloaded.ok) {
        console.warn(
          "replaceBackground skipped:",
          entry.photo.id,
          downloaded.reason,
          downloaded.detail
        );
        continue;
      }

      const processedPath = `${id}/${entry.photo.role}-${BG_PIPELINE_TAG}-${uuidv4()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(processedPath, downloaded.bytes, {
          contentType: downloaded.contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error("processed upload failed:", uploadError.message);
        continue;
      }

      if (
        entry.photo.processed_path &&
        entry.photo.processed_path !== processedPath
      ) {
        await supabase.storage
          .from("listing-photos")
          .remove([entry.photo.processed_path])
          .catch(() => undefined);
      }

      await updatePhoto(entry.photo.id, { processed_path: processedPath });
      if (entry.photo.role === "cover") {
        coverProcessedPath = processedPath;
      }
    }

    const listing = await updateListing(id, {
      status: "ready",
      identified_attrs: identified,
      title: draft.title,
      // Description is a separate hub action ("Write description with AI").
      description: result.listing.description,
      price: draft.price,
      structured_fields: draft.structured_fields,
      cover_processed_path: coverProcessedPath,
    });

    return NextResponse.json({
      listing,
      draftMessage: draft.message ?? null,
      degraded: draft.degraded,
    });
  } catch (err) {
    console.error("process listing error:", err);
    try {
      await updateListing(id, { status: "drafting_photos" });
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? err.message
            : "Could not process listing",
      },
      { status: 500 }
    );
  }
}
