import { NextResponse } from "next/server";
import { authorizeListingAccess } from "@/lib/listing-access";
import { identifyFromPhotos } from "@/lib/ai/identify";
import { getPhotoSteps } from "@/lib/platforms";
import {
  getListingWithPhotos,
  getSignedPhotoUrl,
  reorderListingPhotos,
  updateListing,
  uploadListingPhoto,
} from "@/lib/supabase/queries";
import {
  isIdentifyPhotoRole,
  type PhotoRole,
} from "@/lib/types";

const PHOTO_ROLES: PhotoRole[] = [
  "brand_tag",
  "care_tag",
  "id_tag",
  "inventory",
  "cover",
  "front",
  "back",
  "detail",
  "flaw",
];

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  let body: { orderedIds?: unknown };
  try {
    body = (await request.json()) as { orderedIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((value): value is string => typeof value === "string")
    : null;

  if (!orderedIds || orderedIds.length < 2) {
    return NextResponse.json(
      { error: "orderedIds must include at least two photo ids" },
      { status: 400 }
    );
  }

  try {
    const photos = await reorderListingPhotos(id, orderedIds);
    return NextResponse.json({ photos });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reorder photos";
    const status =
      message.includes("not found") || message.includes("Duplicate")
        ? 400
        : 500;
    if (status === 500) {
      console.error("reorder photos error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

async function runEarlyIdentify(listingId: string) {
  try {
    const result = await getListingWithPhotos(listingId);
    if (!result) return;

    const tagPhotos = result.photos.filter((p) => isIdentifyPhotoRole(p.role));
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
  const { id } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  try {
    const listing = access.listing;

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
    const step = stepIndex >= 0 ? steps[stepIndex] : null;
    // Multi-shot steps stay on the same index until the seller advances manually.
    const nextStep =
      stepIndex >= 0
        ? step?.allowMultiple
          ? stepIndex
          : Math.min(stepIndex + 1, steps.length)
        : listing.photo_step;

    await updateListing(id, {
      photo_step: Math.max(listing.photo_step, nextStep),
    });

    if (isIdentifyPhotoRole(role)) {
      void runEarlyIdentify(id);
    }

    const signedUrl = await getSignedPhotoUrl(photo.storage_path);

    return NextResponse.json(
      {
        photo: {
          ...photo,
          replace_background: photo.replace_background ?? false,
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
