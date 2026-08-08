import { NextResponse } from "next/server";
import { z } from "zod";
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
    // Default US country code when user enters a 10-digit number
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

    const supabase = await createServerSupabaseClient();
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    if (contact.email) {
      const { error } = await supabase.auth.signInWithOtp({
        email: contact.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) {
        console.error("email otp error:", error);
        return NextResponse.json(
          { error: error.message || "Could not send email code" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        channel: "email",
        destination: contact.email,
        message: "We sent a sign-in code to your email.",
      });
    }

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
            "Could not send a text code. Try email, or ask to enable phone sign-in.",
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
      { error: "Could not start sign-in" },
      { status: 500 }
    );
  }
}
