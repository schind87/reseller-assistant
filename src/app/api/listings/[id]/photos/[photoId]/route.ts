import { NextResponse } from "next/server";
import { authorizeListingAccess } from "@/lib/listing-access";
import { deleteListingPhoto } from "@/lib/supabase/queries";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  try {
    await deleteListingPhoto(id, photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete photo";
    const status = message === "Photo not found" ? 404 : 500;
    if (status === 500) {
      console.error("delete photo error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
