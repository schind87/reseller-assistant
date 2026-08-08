import { NextResponse } from "next/server";
import {
  createJoinToken,
  findListingByJoinCode,
} from "@/lib/supabase/queries";

/**
 * Exchange a listing join_code for an extension Bearer token + listingId.
 * Public endpoint (gated by knowing the short code).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const joinCode = (searchParams.get("joinCode") ?? "").trim();

  if (!joinCode || joinCode.length < 4) {
    return NextResponse.json(
      { error: "Provide a valid joinCode" },
      { status: 400 }
    );
  }

  try {
    const listing = await findListingByJoinCode(joinCode);
    if (!listing) {
      return NextResponse.json(
        { error: "No listing found for that code" },
        { status: 404 }
      );
    }

    const join = await createJoinToken(listing.id, "extension", 60 * 24);
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
