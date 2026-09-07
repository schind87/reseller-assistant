import { NextResponse, type NextRequest } from "next/server";
import {
  CANONICAL_PRODUCTION_HOST,
  hostnameOf,
  shouldRedirectToCanonicalHost,
} from "@/lib/canonical-host";
import {
  getJoinSessionFromRequest,
  getSessionFromRequest,
  isUserSession,
} from "@/lib/session";

function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  const hostname = hostnameOf(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      request.nextUrl.hostname
  );
  if (!shouldRedirectToCanonicalHost(hostname)) return null;
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_PRODUCTION_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

/**
 * Gate /app/* behind signed-in user session; allow QR join for listing photo paths.
 */
export async function proxy(request: NextRequest) {
  const canonical = redirectToCanonicalHost(request);
  if (canonical) return canonical;

  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname === "/unlock" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/join" ||
    pathname === "/api/extension/pair" ||
    pathname === "/api/extension/download";

  if (isPublic) {
    return NextResponse.next();
  }

  if (pathname.match(/^\/api\/listings\/[^/]+\/extension$/)) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/platforms/") ||
    pathname === "/api/platforms/schema/discover"
  ) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);
  const joinSession = await getJoinSessionFromRequest(request);
  const signedIn = isUserSession(session);
  const joinOk = Boolean(joinSession);

  // Phone QR sessions may only use the Phone Companion + its APIs (not the laptop hub).
  // A leftover seller login on the phone must not hide the join cookie.
  if (joinOk) {
    const photosPage = pathname.match(/^\/app\/listings\/[^/]+\/photos\/?$/);
    const listingApi = pathname.match(
      /^\/api\/listings\/[^/]+(?:\/photos(?:\/.*)?)?\/?$/
    );
    if (photosPage || listingApi) {
      return NextResponse.next();
    }

    const joinListingId = joinSession?.listingId;
    if (joinListingId && pathname.startsWith("/app")) {
      const photosUrl = new URL(
        `/app/listings/${joinListingId}/photos?phone=1`,
        request.url
      );
      return NextResponse.redirect(photosUrl);
    }

    const listingApp = pathname.match(/^\/app\/listings\/([^/]+)(\/.*)?$/);
    if (listingApp) {
      const listingId = listingApp[1];
      const photosUrl = new URL(
        `/app/listings/${listingId}/photos?phone=1`,
        request.url
      );
      return NextResponse.redirect(photosUrl);
    }
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
