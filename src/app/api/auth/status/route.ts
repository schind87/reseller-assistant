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
        user,
      });
    }

    const join = await getSessionFromCookies();
    const joinOnly = isUnlocked(join) && join?.kind === "join";
    return NextResponse.json({
      unlocked: isUnlocked(join),
      signedIn: false,
      joinOnly,
    });
  } catch (err) {
    console.error("auth status error:", err);
    return NextResponse.json(
      { error: "Could not check sign-in" },
      { status: 500 }
    );
  }
}
