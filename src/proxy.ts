import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, isUnlocked } from "@/lib/session";

/**
 * Next.js 16 renamed middleware → proxy. Same auth gate for /app/*.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname === "/unlock" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/join" ||
    pathname === "/api/extension/pair";

  if (isPublic) {
    return NextResponse.next();
  }

  // Extension API may authenticate via Bearer join token
  if (pathname.match(/^\/api\/listings\/[^/]+\/extension$/)) {
    return NextResponse.next();
  }

  const needsAuth =
    pathname.startsWith("/app") || pathname.startsWith("/api/");

  if (!needsAuth) {
    return NextResponse.next();
  }

  let unlocked = false;
  try {
    const session = await getSessionFromRequest(request);
    unlocked = isUnlocked(session);
  } catch {
    unlocked = false;
  }

  if (unlocked) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unlockUrl = new URL("/unlock", request.url);
  unlockUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
