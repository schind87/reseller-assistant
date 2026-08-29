import { NextResponse } from "next/server";
import { getAuthUser, type AppUser } from "@/lib/api-auth";
import { normalizeEmail } from "@/lib/auth/otp";

/**
 * Comma-separated admin emails, e.g. ADMIN_EMAILS=you@example.com,other@example.com
 * Gates /app/admin/* (AI Photo Lab, Users) and the admin bar.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = adminEmails();
  if (allow.length === 0) return false;
  return allow.includes(normalizeEmail(email));
}

export async function getAdminUser(): Promise<AppUser | null> {
  const user = await getAuthUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function requireAdmin(): Promise<
  { user: AppUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Please sign in" }, { status: 401 }),
    };
  }
  if (!isAdminEmail(user.email)) {
    return {
      error: NextResponse.json({ error: "Admin only" }, { status: 403 }),
    };
  }
  return { user };
}
