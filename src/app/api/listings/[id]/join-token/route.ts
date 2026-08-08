import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  appUrl,
  createJoinToken,
  requestOrigin,
} from "@/lib/supabase/queries";

const bodySchema = z.object({
  purpose: z.enum(["phone", "extension"]).default("phone"),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id, { writeRequiresOwner: true });
  if (access.error) return access.error;

  try {
    const listing = access.listing;

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    const join = await createJoinToken(id, parsed.data.purpose, 120);
    const origin = requestOrigin(request);
    const url =
      parsed.data.purpose === "extension"
        ? appUrl(`/join/${join.token}?purpose=extension`, origin)
        : appUrl(`/join/${join.token}`, origin);

    return NextResponse.json({
      token: join.token,
      url,
      joinCode: listing.join_code,
      expiresAt: join.expires_at,
      purpose: join.purpose,
    });
  } catch (err) {
    console.error("join-token error:", err);
    return NextResponse.json(
      { error: "Could not create join link" },
      { status: 500 }
    );
  }
}
