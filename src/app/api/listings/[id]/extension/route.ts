import { NextResponse } from "next/server";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";
import {
  findListingByJoinCode,
  findValidJoinToken,
  getListingWithPhotos,
  withSignedPhotoUrls,
} from "@/lib/supabase/queries";
import { isPostingPhotoRole } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

async function authorizeExtensionAccess(
  request: Request,
  listingId: string
): Promise<boolean> {
  const session = await getSessionFromCookies();
  if (isUnlocked(session)) return true;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  const token = auth.slice("Bearer ".length).trim();
  if (!token) return false;

  const join = await findValidJoinToken(token);
  if (join && join.listing_id === listingId) return true;

  // Allow pairing by join_code as a convenience for the extension UI
  if (/^[A-Z0-9]{6}$/i.test(token)) {
    const byCode = await findListingByJoinCode(token);
    if (byCode && byCode.id === listingId) return true;
  }

  return false;
}

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

    const posting = result.photos.filter((photo) =>
      isPostingPhotoRole(photo.role)
    );
    const withUrls = await withSignedPhotoUrls(posting);
    const photos = withUrls.map((photo) => ({
      id: photo.id,
      role: photo.role,
      sortOrder: photo.sort_order,
      url:
        (photo.replace_background && photo.processedSignedUrl
          ? photo.processedSignedUrl
          : null) ?? photo.signedUrl,
      originalUrl: photo.signedUrl,
      processedUrl:
        photo.replace_background && photo.processedSignedUrl
          ? photo.processedSignedUrl
          : null,
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
