import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listAdminPhotos } from "@/lib/supabase/admin-queries";
import type { PhotoRole } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "40");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const role = (url.searchParams.get("role") ?? "all") as PhotoRole | "all";
  const q = url.searchParams.get("q") ?? undefined;

  try {
    const result = await listAdminPhotos({
      limit: Number.isFinite(limit) ? limit : 40,
      offset: Number.isFinite(offset) ? offset : 0,
      role,
      q,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("admin photos list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not list photos" },
      { status: 500 }
    );
  }
}
