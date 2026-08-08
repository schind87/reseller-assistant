import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie } from "@/lib/session";
import { consumeJoinToken } from "@/lib/supabase/queries";

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const result = await consumeJoinToken(parsed.data.token);
    if (!result) {
      return NextResponse.json(
        { error: "This join link is invalid or expired" },
        { status: 400 }
      );
    }

    await createSessionCookie();

    return NextResponse.json({
      ok: true,
      listingId: result.listingId,
      purpose: result.purpose,
    });
  } catch (err) {
    console.error("join error:", err);
    return NextResponse.json(
      { error: "Could not join listing" },
      { status: 500 }
    );
  }
}
