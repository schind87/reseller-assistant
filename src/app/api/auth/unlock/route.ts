import { NextResponse } from "next/server";

/** PIN unlock removed — use email/phone OTP at /unlock */
export async function POST() {
  return NextResponse.json(
    {
      error: "PIN sign-in was removed. Use your email or phone number instead.",
    },
    { status: 410 }
  );
}
