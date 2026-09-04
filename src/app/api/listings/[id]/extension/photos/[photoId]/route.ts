import { NextResponse } from "next/server";
import { authorizeExtensionAccess } from "@/lib/extension-auth";
import { downloadPhotoObject } from "@/lib/photo-storage";
import { getListingPhoto } from "@/lib/supabase/queries";
import { isPostingPhotoRole } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; photoId: string }>;
};

function contentTypeForPath(storagePath: string): string {
  const lower = storagePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;

  try {
    const allowed = await authorizeExtensionAccess(request, id);
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const photo = await getListingPhoto(id, photoId);
    if (!photo || !isPostingPhotoRole(photo.role)) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const storagePath =
      photo.replace_background && photo.processed_path
        ? photo.processed_path
        : photo.storage_path;
    const bytes = await downloadPhotoObject(storagePath);
    if (!bytes) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForPath(storagePath),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("extension photo error:", err);
    return NextResponse.json(
      { error: "Could not load listing photo" },
      { status: 500 }
    );
  }
}
