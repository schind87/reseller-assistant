import { NextResponse } from "next/server";
import {
  findListingByJoinCode,
  findValidJoinToken,
  getListingWithPhotos,
  getOrCreateJoinToken,
} from "@/lib/supabase/queries";

/**
 * Exchange a listing join_code or join token for an extension Bearer token + listingId.
 * Public endpoint (gated by knowing the short code or join token).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const joinCode = (searchParams.get("joinCode") ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();

  if (!joinCode && !token) {
    return NextResponse.json(
      { error: "Provide a joinCode or token" },
      { status: 400 }
    );
  }

  try {
    if (token) {
      const existing = await findValidJoinToken(token);
      if (!existing) {
        return NextResponse.json(
          { error: "Join link is invalid or expired" },
          { status: 404 }
        );
      }

      const result = await getListingWithPhotos(existing.listing_id);
      return NextResponse.json({
        token: existing.token,
        listingId: existing.listing_id,
        platform: result?.listing.platform ?? null,
        joinCode: result?.listing.join_code ?? null,
      });
    }

    if (!joinCode || joinCode.length < 4) {
      return NextResponse.json(
        { error: "Provide a valid joinCode" },
        { status: 400 }
      );
    }

    const listing = await findListingByJoinCode(joinCode);
    if (!listing) {
      return NextResponse.json(
        { error: "No listing found for that code" },
        { status: 404 }
      );
    }

    const join = await getOrCreateJoinToken(listing.id, "extension");
    return NextResponse.json({
      token: join.token,
      listingId: listing.id,
      platform: listing.platform,
      joinCode: listing.join_code,
    });
  } catch (err) {
    console.error("extension pair error:", err);
    return NextResponse.json(
      { error: "Could not pair extension" },
      { status: 500 }
    );
  }
}
