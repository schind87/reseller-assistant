import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeLoginOtp, upsertProfile } from "@/lib/auth/otp";
import { createUserSessionCookie } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  contact: z.string().min(3),
  token: z.string().min(4).max(12),
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
        { error: "Enter your email/phone and the code" },
        { status: 400 }
      );
    }

    const contact = normalizeContact(parsed.data.contact);
    const token = parsed.data.token.trim();

    if (contact.email) {
      const ok = await consumeLoginOtp(contact.email, token);
      if (!ok) {
        return NextResponse.json(
          { error: "That code did not work. Try again." },
          { status: 401 }
        );
      }
      const profile = await upsertProfile({ email: contact.email });
      await createUserSessionCookie({
        userId: profile.id,
        email: profile.email,
        phone: profile.phone,
      });
      return NextResponse.json({
        ok: true,
        user: { id: profile.id, email: profile.email },
      });
    }

    if (contact.phone) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: contact.phone,
        token,
        type: "sms",
      });
      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || "That code did not work. Try again." },
          { status: 401 }
        );
      }
      const profile = await upsertProfile({ phone: contact.phone });
      await createUserSessionCookie({
        userId: profile.id,
        email: profile.email,
        phone: profile.phone,
      });
      return NextResponse.json({
        ok: true,
        user: { id: profile.id, phone: profile.phone },
      });
    }

    return NextResponse.json(
      { error: "Enter a valid email or phone number" },
      { status: 400 }
    );
  } catch (err) {
    console.error("otp verify error:", err);
    return NextResponse.json(
      { error: "Could not verify code" },
      { status: 500 }
    );
  }
}
