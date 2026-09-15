import { NextResponse } from "next/server";
import {
  adminClosetCheckResponse,
  profileExists,
} from "@/lib/admin-closet-api";
import { requireAdmin } from "@/lib/admin";
import { deleteAdminUser } from "@/lib/supabase/admin-users";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (!(await profileExists(id))) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const json = await request.json().catch(() => null);
    return await adminClosetCheckResponse(id, json);
  } catch (err) {
    console.error("admin check closet error:", err);
    return NextResponse.json(
      { error: "Could not save closet listings" },
      { status: 500 }
    );
  }
}

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
