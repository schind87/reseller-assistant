import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authorizeListingAccess } from "@/lib/listing-access";
import { draftListing } from "@/lib/ai/draft";
import { fetchImageBytes, removeBackground } from "@/lib/ai/background";
import { identifyFromPhotos } from "@/lib/ai/identify";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getListingWithPhotos,
  getSignedPhotoUrl,
  getWorkspace,
  updateListing,
  updatePhoto,
} from "@/lib/supabase/queries";

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

    const preferTagUrls = signedUrls
      .filter(
        (p) => p.photo.role === "brand_tag" || p.photo.role === "care_tag"
      )
      .map((p) => p.url);
    const allUrls = signedUrls.map((p) => p.url);
    const identifyUrls = preferTagUrls.length > 0 ? preferTagUrls : allUrls;

    const identified = await identifyFromPhotos(identifyUrls);

    const workspace = await getWorkspace();
    const draft = await draftListing({
      platform: result.listing.platform,
      identified,
      imageUrls: allUrls,
      smokePetNotes: workspace.default_smoke_pet_notes,
    });

    let coverProcessedPath: string | null = result.listing.cover_processed_path;

    const supabase = createAdminClient();
    for (const role of ["cover", "front"] as const) {
      const entry = signedUrls.find((p) => p.photo.role === role);
      if (!entry) continue;

      const processedUrl = await removeBackground(entry.url);
      if (!processedUrl) continue;

      const downloaded = await fetchImageBytes(processedUrl);
      if (!downloaded) continue;

      const processedPath = `${id}/${role}-bg-${uuidv4()}.png`;
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

      await updatePhoto(entry.photo.id, { processed_path: processedPath });
      if (role === "cover") {
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
      { error: "Could not process listing" },
      { status: 500 }
    );
  }
}
