import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateOtpCode,
  normalizeEmail,
  sendSignInEmail,
  storeLoginOtp,
} from "@/lib/auth/otp";

const bodySchema = z.object({
  email: z.string().email().optional(),
  contact: z.string().min(3).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter your email address" },
        { status: 400 }
      );
    }

    const raw = parsed.data.email || parsed.data.contact || "";
    if (!raw.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 }
      );
    }
    const email = normalizeEmail(raw);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email sign-in is not configured yet (missing Resend)." },
        { status: 500 }
      );
    }

    const code = generateOtpCode();
    await storeLoginOtp(email, code);
    await sendSignInEmail(email, code);

    return NextResponse.json({
      ok: true,
      channel: "email",
      destination: email,
      message: "We emailed you a 6-digit sign-in code.",
    });
  } catch (err) {
    console.error("otp start error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not start sign-in",
      },
      { status: 500 }
    );
  }
}
