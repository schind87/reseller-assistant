import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  getListingWithPhotos,
  getSignedPhotoUrl,
  markPosted,
  updateListing,
} from "@/lib/supabase/queries";
import type { ListingPhotoWithUrl } from "@/lib/types";

const patchSchema = z.object({
  status: z
    .enum(["drafting_photos", "processing", "ready", "posting", "posted"])
    .optional(),
  photo_step: z.number().int().min(0).optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  structured_fields: z
    .object({
      brand: z.string().nullable(),
      category: z.string().nullable(),
      subcategory: z.string().nullable(),
      size: z.string().nullable(),
      color: z.string().nullable(),
      colorSecondary: z.string().nullable(),
      condition: z.string().nullable(),
      originalPrice: z.number().nullable(),
      styleTags: z.array(z.string()),
      measurements: z.string().nullable(),
      fabric: z.string().nullable(),
      smokePetNotes: z.string().nullable(),
      packageWeight: z.string().nullable(),
      shippingPayer: z.string().nullable(),
    })
    .optional(),
  identified_attrs: z
    .object({
      brand: z.string().nullable(),
      size: z.string().nullable(),
      color: z.string().nullable(),
      category: z.string().nullable(),
      material: z.string().nullable(),
      condition: z.string().nullable(),
      confidence: z.number(),
      notes: z.string(),
      needsConfirm: z.array(z.string()),
    })
    .nullable()
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  try {
    const result = await getListingWithPhotos(id);
    if (!result) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const photos: ListingPhotoWithUrl[] = await Promise.all(
      result.photos.map(async (photo) => ({
        ...photo,
        signedUrl: await getSignedPhotoUrl(photo.storage_path),
        processedSignedUrl: photo.processed_path
          ? await getSignedPhotoUrl(photo.processed_path)
          : null,
      }))
    );

    return NextResponse.json({ listing: result.listing, photos });
  } catch (err) {
    console.error("get listing error:", err);
    return NextResponse.json(
      { error: "Could not load listing" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  try {
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    }

    const ownerWrite =
      access.userId != null &&
      (!access.listing.user_id || access.listing.user_id === access.userId);

    if (!ownerWrite) {
      const keys = Object.keys(parsed.data);
      const onlyPhotoStep =
        parsed.data.photo_step !== undefined &&
        keys.every((key) => key === "photo_step");
      if (!onlyPhotoStep) {
        return NextResponse.json({ error: "Not your listing" }, { status: 403 });
      }
    }

    const listing =
      parsed.data.status === "posted"
        ? await markPosted(id)
        : await updateListing(id, parsed.data);
    return NextResponse.json({ listing });
  } catch (err) {
    console.error("patch listing error:", err);
    return NextResponse.json(
      { error: "Could not update listing" },
      { status: 500 }
    );
  }
}
