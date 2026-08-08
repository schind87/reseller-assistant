import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { identifyFromPhotos } from "@/lib/ai/identify";
import { getPhotoSteps } from "@/lib/platforms";
import {
  getListing,
  getListingWithPhotos,
  getSignedPhotoUrl,
  updateListing,
  uploadListingPhoto,
} from "@/lib/supabase/queries";
import type { PhotoRole } from "@/lib/types";

const PHOTO_ROLES: PhotoRole[] = [
  "brand_tag",
  "care_tag",
  "cover",
  "front",
  "back",
  "detail",
  "flaw",
];

type RouteContext = { params: Promise<{ id: string }> };

async function runEarlyIdentify(listingId: string) {
  try {
    const result = await getListingWithPhotos(listingId);
    if (!result) return;

    const tagPhotos = result.photos.filter(
      (p) => p.role === "brand_tag" || p.role === "care_tag"
    );
    if (tagPhotos.length === 0) return;

    const urls = (
      await Promise.all(tagPhotos.map((p) => getSignedPhotoUrl(p.storage_path)))
    ).filter((u): u is string => Boolean(u));

    if (urls.length === 0) return;

    const identified = await identifyFromPhotos(urls);
    await updateListing(listingId, { identified_attrs: identified });
  } catch (err) {
    console.error("early identify failed:", err);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  try {
    const listing = await getListing(id);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("photo");
    const roleRaw = String(form.get("role") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Photo file is required" }, { status: 400 });
    }

    if (!PHOTO_ROLES.includes(roleRaw as PhotoRole)) {
      return NextResponse.json({ error: "Invalid photo role" }, { status: 400 });
    }

    const role = roleRaw as PhotoRole;
    const bytes = await file.arrayBuffer();
    const contentType = file.type || "image/jpeg";

    const { photo } = await uploadListingPhoto(id, role, bytes, contentType);

    const steps = getPhotoSteps(listing.platform);
    const stepIndex = steps.findIndex((s) => s.role === role);
    const nextStep =
      stepIndex >= 0 ? Math.min(stepIndex + 1, steps.length) : listing.photo_step;

    await updateListing(id, {
      photo_step: Math.max(listing.photo_step, nextStep),
    });

    if (role === "brand_tag" || role === "care_tag") {
      void runEarlyIdentify(id);
    }

    const signedUrl = await getSignedPhotoUrl(photo.storage_path);

    return NextResponse.json(
      {
        photo: {
          ...photo,
          signedUrl,
          processedSignedUrl: null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("upload photo error:", err);
    return NextResponse.json(
      { error: "Could not upload photo" },
      { status: 500 }
    );
  }
}
