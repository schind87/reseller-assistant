import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ra_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const JOIN_COOKIE = "ra_join";
const JOIN_MAX_AGE_SECONDS = 60 * 60 * 12;

export type AuthSessionPayload = {
  kind: "user";
  userId: string;
  email?: string;
  phone?: string;
};

export type JoinSessionPayload = {
  kind: "join";
  unlocked: true;
  listingId?: string;
};

export type SessionPayload = AuthSessionPayload | JoinSessionPayload;

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "dev-only-insecure-secret";
  return new TextEncoder().encode(secret);
}

export async function signUserSession(payload: {
  userId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string> {
  return new SignJWT({
    kind: "user",
    userId: payload.userId,
    email: payload.email ?? undefined,
    phone: payload.phone ?? undefined,
  } satisfies AuthSessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function signJoinToken(listingId?: string): Promise<string> {
  return new SignJWT({
    kind: "join",
    unlocked: true,
    listingId,
  } satisfies JoinSessionPayload)
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
    if (payload.kind === "user" && typeof payload.userId === "string") {
      return {
        kind: "user",
        userId: payload.userId,
        email: typeof payload.email === "string" ? payload.email : undefined,
        phone: typeof payload.phone === "string" ? payload.phone : undefined,
      };
    }
    if (payload.unlocked === true || payload.kind === "join") {
      return {
        kind: "join",
        unlocked: true,
        listingId:
          typeof payload.listingId === "string" ? payload.listingId : undefined,
      };
    }
    // Legacy PIN/join cookies
    if (payload.unlocked === true) {
      return { kind: "join", unlocked: true };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createUserSessionCookie(payload: {
  userId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  const token = await signUserSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function createSessionCookie(listingId?: string): Promise<void> {
  const token = await signJoinToken(listingId);
  const cookieStore = await cookies();
  cookieStore.set(JOIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: JOIN_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  for (const name of [SESSION_COOKIE, JOIN_COOKIE]) {
    cookieStore.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const userToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (userToken) {
    const session = await verifySessionToken(userToken);
    if (session) return session;
  }
  const joinToken = cookieStore.get(JOIN_COOKIE)?.value;
  if (joinToken) return verifySessionToken(joinToken);
  return null;
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const userToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (userToken) {
    const session = await verifySessionToken(userToken);
    if (session) return session;
  }
  const joinToken = request.cookies.get(JOIN_COOKIE)?.value;
  if (joinToken) return verifySessionToken(joinToken);
  return null;
}

export function isUserSession(
  session: SessionPayload | null | undefined
): session is AuthSessionPayload {
  return session?.kind === "user";
}

export function isUnlocked(
  session: SessionPayload | null | undefined
): boolean {
  return session?.kind === "user" || session?.kind === "join";
}
