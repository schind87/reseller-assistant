import { NextResponse } from "next/server";
import { touchProjectKeepalive } from "@/lib/supabase/keepalive";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const result = await touchProjectKeepalive();
    return NextResponse.json({ ...result, source: "app" });
  } catch (err) {
    console.error("supabase keepalive:", err);
    return NextResponse.json(
      { ok: false, error: "Keep-alive could not reach hosted Supabase" },
      { status: 503 }
    );
  }
}
