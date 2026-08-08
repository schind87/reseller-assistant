import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("logout error:", err);
    return NextResponse.json({ error: "Could not sign out" }, { status: 500 });
  }
}
