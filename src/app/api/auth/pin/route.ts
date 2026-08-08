import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { getProfileById, isValidPin, setProfilePin } from "@/lib/auth/otp";

const bodySchema = z.object({
  pin: z.string().min(4).max(8),
  confirmPin: z.string().min(4).max(8),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const profile = await getProfileById(auth.user.id);
  return NextResponse.json({
    hasPin: Boolean(profile?.pin_hash),
    email: profile?.email ?? auth.user.email,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a PIN and confirm it" },
        { status: 400 }
      );
    }

    const { pin, confirmPin } = parsed.data;
    if (pin !== confirmPin) {
      return NextResponse.json(
        { error: "Those PINs do not match" },
        { status: 400 }
      );
    }
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 to 8 digits" },
        { status: 400 }
      );
    }

    await setProfilePin(auth.user.id, pin);
    return NextResponse.json({ ok: true, hasPin: true });
  } catch (err) {
    console.error("set pin error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save PIN" },
      { status: 500 }
    );
  }
}
