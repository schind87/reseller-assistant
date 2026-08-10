import { NextResponse } from "next/server";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  duplicatePhotoAsListingRole,
  withSignedPhotoUrls,
} from "@/lib/supabase/queries";
import {
  isPostingPhotoRole,
  type PhotoRole,
} from "@/lib/types";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id, photoId } = await context.params;
  const access = await authorizeListingAccess(id);
  if (access.error) return access.error;

  let body: { role?: string };
  try {
    body = (await request.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = body.role as PhotoRole | undefined;
  if (!role || !isPostingPhotoRole(role)) {
    return NextResponse.json(
      {
        error:
          "Choose a listing photo type: cover, front, back, detail, or flaw.",
      },
      { status: 400 }
    );
  }

  try {
    const photo = await duplicatePhotoAsListingRole(id, photoId, role);
    const [withUrl] = await withSignedPhotoUrls([photo]);
    return NextResponse.json({ photo: withUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not add photo to listing";
    const status = message === "Photo not found" ? 404 : 400;
    if (status !== 404) {
      console.error("use-in-listing error:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
