import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/** Temporary QR join cookie — not the primary login. */
export const SESSION_COOKIE = "ra_join";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours for phone photo session

export type SessionPayload = {
  unlocked: true;
  listingId?: string;
};

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "dev-only-insecure-secret";
  return new TextEncoder().encode(secret);
}

export async function signJoinToken(listingId?: string): Promise<string> {
  return new SignJWT({ unlocked: true, listingId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.unlocked === true) {
      return {
        unlocked: true,
        listingId:
          typeof payload.listingId === "string" ? payload.listingId : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSessionCookie(listingId?: string): Promise<void> {
  const token = await signJoinToken(listingId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function isUnlocked(
  session: SessionPayload | null | undefined
): session is SessionPayload {
  return session?.unlocked === true;
}
