import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateOtpCode,
  sendSignInEmail,
  storeLoginOtp,
} from "@/lib/auth/otp";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  contact: z.string().min(3),
});

function normalizeContact(raw: string): { email?: string; phone?: string } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return { email: trimmed.toLowerCase() };
  }
  const digits = trimmed.replace(/[^\d+]/g, "");
  let phone = digits;
  if (phone && !phone.startsWith("+")) {
    if (/^\d{10}$/.test(phone)) phone = `+1${phone}`;
    else if (/^\d+$/.test(phone)) phone = `+${phone}`;
  }
  return { phone };
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter your email or phone number" },
        { status: 400 }
      );
    }

    const contact = normalizeContact(parsed.data.contact);
    if (!contact.email && !contact.phone) {
      return NextResponse.json(
        { error: "Enter a valid email or phone number" },
        { status: 400 }
      );
    }

    // Email via Resend (app-owned OTP)
    if (contact.email) {
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json(
          { error: "Email sign-in is not configured yet (missing Resend)." },
          { status: 500 }
        );
      }
      const code = generateOtpCode();
      await storeLoginOtp(contact.email, "email", code);
      await sendSignInEmail(contact.email, code);
      return NextResponse.json({
        ok: true,
        channel: "email",
        destination: contact.email,
        message: "We emailed you a 6-digit sign-in code.",
      });
    }

    // Phone still uses Supabase Auth SMS when configured
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: contact.phone!,
      options: { shouldCreateUser: true },
    });
    if (error) {
      console.error("phone otp error:", error);
      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not send a text code. Try email for now, or enable phone SMS in Supabase.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      channel: "phone",
      destination: contact.phone,
      message: "We texted you a sign-in code.",
    });
  } catch (err) {
    console.error("otp start error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not start sign-in",
      },
      { status: 500 }
    );
  }
}
