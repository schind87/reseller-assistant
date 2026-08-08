import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getSessionFromCookies,
  isUnlocked,
  type SessionPayload,
} from "@/lib/session";

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Require a signed-in Supabase user (email/phone OTP). */
export async function requireUser(): Promise<
  { user: User; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Please sign in" }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * Allow either a signed-in user or a temporary QR join session
 * (phone photo coach without full login).
 */
export async function requireUserOrJoinSession(): Promise<
  | { user: User | null; join: SessionPayload | null; error?: undefined }
  | { error: NextResponse }
> {
  const user = await getAuthUser();
  if (user) return { user, join: null };

  const join = await getSessionFromCookies();
  if (isUnlocked(join)) return { user: null, join };

  return {
    error: NextResponse.json({ error: "Please sign in" }, { status: 401 }),
  };
}

/** @deprecated Use requireUser */
export async function requireSession(): Promise<NextResponse | null> {
  const result = await requireUser();
  return result.error ?? null;
}
