import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authorizeListingAccess } from "@/lib/listing-access";
import { draftListing } from "@/lib/ai/draft";
import { replaceBackground } from "@/lib/ai/background";
import { identifyFromPhotos } from "@/lib/ai/identify";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getListingWithPhotos,
  getSignedPhotoUrl,
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
        { error: "Add at least one photo before running AI." },
        { status: 400 }
      );
    }

    await updateListing(id, { status: "processing" });

    const signedUrls = (
      await Promise.all(
        result.photos.map(async (photo) => ({
          photo,
          url: await getSignedPhotoUrl(photo.storage_path),
        }))
      )
    ).filter((p): p is { photo: (typeof result.photos)[number]; url: string } =>
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
      const downloaded = await replaceBackground(entry.url, {
        keepHanger: true,
      });
      if (!downloaded) continue;

      const processedPath = `${id}/${entry.photo.role}-bg-${uuidv4()}.png`;
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
      description: draft.description,
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
