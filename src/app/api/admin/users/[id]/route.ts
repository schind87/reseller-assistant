import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { deleteAdminUser } from "@/lib/supabase/admin-users";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account from here." },
      { status: 400 }
    );
  }

  try {
    await deleteAdminUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not delete user";
    const status = message === "User not found" ? 404 : 500;
    if (status === 500) {
      console.error("admin delete user error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
