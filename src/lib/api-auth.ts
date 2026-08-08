import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getSessionFromCookies,
  isUnlocked,
  isUserSession,
  type SessionPayload,
} from "@/lib/session";

export type AppUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

export async function getAuthUser(): Promise<AppUser | null> {
  const session = await getSessionFromCookies();
  if (isUserSession(session)) {
    return {
      id: session.userId,
      email: session.email ?? null,
      phone: session.phone ?? null,
    };
  }
  return null;
}

/** Require a signed-in user (email/phone OTP). */
export async function requireUser(): Promise<
  { user: AppUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Please sign in" }, { status: 401 }),
    };
  }
  return { user };
}

export async function requireUserOrJoinSession(): Promise<
  | { user: AppUser | null; join: SessionPayload | null; error?: undefined }
  | { error: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (isUserSession(session)) {
    return {
      user: {
        id: session.userId,
        email: session.email,
        phone: session.phone,
      },
      join: null,
    };
  }
  if (isUnlocked(session)) {
    return { user: null, join: session };
  }
  return {
    error: NextResponse.json({ error: "Please sign in" }, { status: 401 }),
  };
}

/** @deprecated Use requireUser */
export async function requireSession(): Promise<NextResponse | null> {
  const result = await requireUser();
  return result.error ?? null;
}

/** Compatibility shim — not a Supabase Auth user. */
export type { User };
