import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import {
  findListingByJoinCode,
  findValidJoinToken,
} from "@/lib/supabase/queries";

/** Allow signed-in users or a paired extension Bearer token. */
export async function authorizeSchemaSync(
  request: Request
): Promise<NextResponse | null> {
  const user = await getAuthUser();
  if (user) return null;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const join = await findValidJoinToken(token);
  if (join) return null;

  if (/^[A-Z0-9]{6}$/i.test(token)) {
    const byCode = await findListingByJoinCode(token);
    if (byCode) return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
