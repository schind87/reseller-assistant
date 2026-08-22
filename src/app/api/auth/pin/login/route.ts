import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail, verifyProfilePin } from "@/lib/auth/otp";
import { createUserSessionCookie } from "@/lib/session";

const bodySchema = z.object({
  email: z.string().min(3),
  pin: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter your email and PIN" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 }
      );
    }

    const pin = parsed.data.pin.trim();
    if (!/^\d{4,8}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    const profile = await verifyProfilePin(email, pin);
    if (!profile) {
      return NextResponse.json(
        {
          error: "Email or PIN did not match.",
        },
        { status: 401 }
      );
    }

    await createUserSessionCookie({
      userId: profile.id,
      email: profile.email,
    });

    return NextResponse.json({
      ok: true,
      user: { id: profile.id, email: profile.email },
      hasPin: true,
    });
  } catch (err) {
    console.error("pin login error:", err);
    return NextResponse.json(
      { error: "Could not sign in with PIN" },
      { status: 500 }
    );
  }
}
