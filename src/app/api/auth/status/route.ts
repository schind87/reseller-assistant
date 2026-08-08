import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (user) {
      return NextResponse.json({
        unlocked: true,
        signedIn: true,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
        },
      });
    }

    const join = await getSessionFromCookies();
    return NextResponse.json({
      unlocked: isUnlocked(join),
      signedIn: false,
      joinOnly: isUnlocked(join),
    });
  } catch (err) {
    console.error("auth status error:", err);
    return NextResponse.json({ unlocked: false, signedIn: false });
  }
}
