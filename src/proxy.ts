import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSessionFromRequest, isUnlocked } from "@/lib/session";

/**
 * Next.js 16 proxy: refresh Supabase auth cookies and gate /app/*.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let signedIn = false;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }

  const isPublic =
    pathname === "/" ||
    pathname === "/unlock" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/join" ||
    pathname === "/api/extension/pair";

  if (isPublic) {
    return response;
  }

  if (pathname.match(/^\/api\/listings\/[^/]+\/extension$/)) {
    return response;
  }

  // Photo coach via QR join cookie
  const join = await getSessionFromRequest(request);
  const joinOk = isUnlocked(join);
  if (
    joinOk &&
    (pathname.startsWith("/app/listings/") ||
      pathname.match(/^\/api\/listings\/[^/]+(\/photos)?$/))
  ) {
    return response;
  }

  const needsAuth =
    pathname.startsWith("/app") || pathname.startsWith("/api/");

  if (!needsAuth) {
    return response;
  }

  if (signedIn) {
    return response;
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
