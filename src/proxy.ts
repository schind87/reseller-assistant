import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionFromRequest,
  isUnlocked,
  isUserSession,
} from "@/lib/session";

/**
 * Gate /app/* behind signed-in user session; allow QR join for listing photo paths.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname === "/unlock" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/join" ||
    pathname === "/api/extension/pair";

  if (isPublic) {
    return NextResponse.next();
  }

  if (pathname.match(/^\/api\/listings\/[^/]+\/extension$/)) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);
  const signedIn = isUserSession(session);
  const joinOk = isUnlocked(session) && session?.kind === "join";

  if (
    joinOk &&
    (pathname.startsWith("/app/listings/") ||
      pathname.match(/^\/api\/listings\/[^/]+(\/photos)?$/))
  ) {
    return NextResponse.next();
  }

  const needsAuth =
    pathname.startsWith("/app") || pathname.startsWith("/api/");

  if (!needsAuth) {
    return NextResponse.next();
  }

  if (signedIn) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
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
