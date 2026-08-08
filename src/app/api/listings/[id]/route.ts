import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
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
      size: z.string().nullable(),
      color: z.string().nullable(),
      condition: z.string().nullable(),
      originalPrice: z.number().nullable(),
      styleTags: z.array(z.string()),
      measurements: z.string().nullable(),
      fabric: z.string().nullable(),
      smokePetNotes: z.string().nullable(),
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
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

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
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  try {
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
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
