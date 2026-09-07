import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getAuthUser } from "@/lib/api-auth";
import { getJoinSessionFromCookies } from "@/lib/session";

export async function GET() {
  try {
    const [user, join] = await Promise.all([
      getAuthUser(),
      getJoinSessionFromCookies(),
    ]);
    const hasJoin = join?.kind === "join";
    if (user) {
      return NextResponse.json({
        unlocked: true,
        signedIn: true,
        isAdmin: isAdminEmail(user.email),
        user,
        joinOnly: hasJoin,
      });
    }

    return NextResponse.json({
      unlocked: hasJoin,
      signedIn: false,
      isAdmin: false,
      joinOnly: hasJoin,
    });
  } catch (err) {
    console.error("auth status error:", err);
    return NextResponse.json(
      { error: "Could not check sign-in" },
      { status: 500 }
    );
  }
}
