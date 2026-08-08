import { NextResponse } from "next/server";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    return NextResponse.json({ unlocked: isUnlocked(session) });
  } catch (err) {
    console.error("auth status error:", err);
    return NextResponse.json({ unlocked: false });
  }
}
