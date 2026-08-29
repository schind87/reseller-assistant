import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listAdminUsers } from "@/lib/supabase/admin-users";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const users = await listAdminUsers();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("admin users list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not list users" },
      { status: 500 }
    );
  }
}
