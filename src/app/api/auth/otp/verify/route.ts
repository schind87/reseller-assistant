import { NextResponse } from "next/server";
import { z } from "zod";
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
    const supabase = await createServerSupabaseClient();

    if (contact.email) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: contact.email,
        token,
        type: "email",
      });
      if (error || !data.session) {
        return NextResponse.json(
          { error: error?.message || "That code did not work. Try again." },
          { status: 401 }
        );
      }
      return NextResponse.json({
        ok: true,
        user: { id: data.user?.id, email: data.user?.email },
      });
    }

    if (contact.phone) {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: contact.phone,
        token,
        type: "sms",
      });
      if (error || !data.session) {
        return NextResponse.json(
          { error: error?.message || "That code did not work. Try again." },
          { status: 401 }
        );
      }
      return NextResponse.json({
        ok: true,
        user: { id: data.user?.id, phone: data.user?.phone },
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
