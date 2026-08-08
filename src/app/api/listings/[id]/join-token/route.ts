import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import {
  appUrl,
  createJoinToken,
  getListing,
} from "@/lib/supabase/queries";

const bodySchema = z.object({
  purpose: z.enum(["phone", "extension"]).default("phone"),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  try {
    const listing = await getListing(id);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    const join = await createJoinToken(id, parsed.data.purpose, 120);
    const url =
      parsed.data.purpose === "extension"
        ? appUrl(`/join/${join.token}?purpose=extension`)
        : appUrl(`/join/${join.token}`);

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
