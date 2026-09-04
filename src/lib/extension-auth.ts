import { findListingByJoinCode, findValidJoinToken } from "@/lib/supabase/queries";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";

export async function authorizeExtensionAccess(
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

  if (/^[A-Z0-9]{6}$/i.test(token)) {
    const byCode = await findListingByJoinCode(token);
    if (byCode && byCode.id === listingId) return true;
  }

  return false;
}
