import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie } from "@/lib/session";

const bodySchema = z.object({
  pin: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const expected = process.env.HOUSEHOLD_PIN ?? "1234";
    if (parsed.data.pin !== expected) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    await createSessionCookie();
    return NextResponse.json({ ok: true, unlocked: true });
  } catch (err) {
    console.error("unlock error:", err);
    return NextResponse.json({ error: "Could not unlock" }, { status: 500 });
  }
}
