import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("logout error:", err);
    return NextResponse.json({ error: "Could not log out" }, { status: 500 });
  }
}
