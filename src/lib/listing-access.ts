import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";
import { getListing } from "@/lib/supabase/queries";
import type { Listing } from "@/lib/types";

/**
 * Allow listing access for the owning user, or a QR join session for that listing.
 * When writeRequiresOwner is true, only the signed-in owner may proceed
 * (used for AI process / join-token creation). Photo upload allows join sessions.
 */
export async function authorizeListingAccess(
  listingId: string,
  opts?: { writeRequiresOwner?: boolean }
): Promise<
  | { listing: Listing; userId: string | null; error?: undefined }
  | { error: NextResponse }
> {
  const listing = await getListing(listingId);
  if (!listing) {
    return {
      error: NextResponse.json({ error: "Listing not found" }, { status: 404 }),
    };
  }

  const user = await getAuthUser();
  if (user && listing.user_id === user.id) {
    return { listing, userId: user.id };
  }

  // Legacy listings without user_id: signed-in user may use them
  if (user && !listing.user_id) {
    return { listing, userId: user.id };
  }

  if (opts?.writeRequiresOwner) {
    return {
      error: NextResponse.json(
        { error: user ? "Not your listing" : "Please sign in" },
        { status: user ? 403 : 401 }
      ),
    };
  }

  const join = await getSessionFromCookies();
  if (
    isUnlocked(join) &&
    (!join.listingId || join.listingId === listingId)
  ) {
    return { listing, userId: user?.id ?? null };
  }

  if (!user) {
    return {
      error: NextResponse.json({ error: "Please sign in" }, { status: 401 }),
    };
  }

  return {
    error: NextResponse.json({ error: "Not your listing" }, { status: 403 }),
  };
}
