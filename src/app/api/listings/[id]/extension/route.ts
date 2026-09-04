import { NextResponse } from "next/server";
import { authorizeExtensionAccess } from "@/lib/extension-auth";
import { getListingWithPhotos } from "@/lib/supabase/queries";
import { isPostingPhotoRole } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const allowed = await authorizeExtensionAccess(request, id);
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getListingWithPhotos(id);
    if (!result) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const photos = result.photos
      .filter((photo) => isPostingPhotoRole(photo.role))
      .map((photo) => ({
        id: photo.id,
        role: photo.role,
        sortOrder: photo.sort_order,
      }));

    const { listing } = result;

    return NextResponse.json({
      id: listing.id,
      platform: listing.platform,
      status: listing.status,
      joinCode: listing.join_code,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      structuredFields: listing.structured_fields,
      identifiedAttrs: listing.identified_attrs,
      photos,
    });
  } catch (err) {
    console.error("extension payload error:", err);
    return NextResponse.json(
      { error: "Could not load listing for extension" },
      { status: 500 }
    );
  }
}
