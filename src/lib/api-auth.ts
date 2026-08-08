import { NextResponse } from "next/server";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";

export async function requireSession(): Promise<NextResponse | null> {
  const session = await getSessionFromCookies();
  if (!isUnlocked(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
