import { NextResponse } from "next/server";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  deleteListingPhoto,
  moveListingPhoto,
  withSignedPhotoUrls,
} from "@/lib/supabase/queries";
import type { PhotoRole } from "@/lib/types";

const PHOTO_ROLES: PhotoRole[] = [
  "brand_tag",
  "care_tag",
  "id_tag",
  "inventory",
  "cover",
  "front",
  "back",
  "detail",
  "tag",
  "flaw",
];

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  let body: { role?: string };
  try {
    body = (await request.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = body.role as PhotoRole | undefined;
  if (!role || !PHOTO_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid photo role" }, { status: 400 });
  }

  try {
    const photo = await moveListingPhoto(id, photoId, role);
    const [withUrl] = await withSignedPhotoUrls([photo]);
    return NextResponse.json({ photo: withUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not move photo";
    const status = message === "Photo not found" ? 404 : 500;
    if (status === 500) {
      console.error("move photo error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  try {
    await deleteListingPhoto(id, photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete photo";
    const status = message === "Photo not found" ? 404 : 500;
    if (status === 500) {
      console.error("delete photo error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
