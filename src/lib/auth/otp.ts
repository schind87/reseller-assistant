import { createHash, randomInt } from "crypto";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultListingPreferences,
  parseListingPreferences,
  type ListingPreferences,
} from "@/lib/seller-preferences";

export type Profile = {
  id: string;
  email: string | null;
  pin_hash: string | null;
  listing_preferences: ListingPreferences;
  listing_prefs_completed_at: string | null;
};

function mapProfile(row: {
  id: string;
  email: string | null;
  pin_hash: string | null;
  listing_preferences?: unknown;
  listing_prefs_completed_at?: string | null;
}): Profile {
  return {
    id: row.id,
    email: row.email,
    pin_hash: row.pin_hash,
    listing_preferences: parseListingPreferences(
      row.listing_preferences ?? defaultListingPreferences()
    ),
    listing_prefs_completed_at: row.listing_prefs_completed_at ?? null,
  };
}

const PROFILE_SELECT =
  "id, email, pin_hash, listing_preferences, listing_prefs_completed_at";

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function hashPin(pin: string, userId: string): string {
  return createHash("sha256")
    .update(`reseller-assistant-pin:${userId}:${pin}`)
    .digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export async function storeLoginOtp(
  email: string,
  code: string,
  ttlMinutes = 10
): Promise<void> {
  const supabase = createAdminClient();
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const { error } = await supabase.from("login_otps").insert({
    contact: email,
    channel: "email",
    code_hash: hashOtpCode(code),
    expires_at: expires,
  });
  if (error) throw new Error(`storeLoginOtp: ${error.message}`);
}

export async function consumeLoginOtp(
  email: string,
  code: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("login_otps")
    .select("*")
    .eq("contact", email)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(`consumeLoginOtp: ${error.message}`);
  const match = (data ?? []).find((row) => row.code_hash === hashOtpCode(code));
  if (!match) return false;

  await supabase
    .from("login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", match.id);

  return true;
}

export async function upsertProfileByEmail(email: string): Promise<Profile> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return mapProfile(existing);
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({ email })
    .select(PROFILE_SELECT)
    .single();
  if (error) throw new Error(`upsertProfileByEmail: ${error.message}`);
  return mapProfile(data);
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`getProfileByEmail: ${error.message}`);
  if (!data) return null;
  return mapProfile(data);
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getProfileById: ${error.message}`);
  if (!data) return null;
  return mapProfile(data);
}

export async function updateListingPreferences(
  userId: string,
  preferences: ListingPreferences
): Promise<Profile> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      listing_preferences: preferences,
      listing_prefs_completed_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw new Error(`updateListingPreferences: ${error.message}`);
  return mapProfile(data);
}

export async function setProfilePin(
  userId: string,
  pin: string
): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4 to 8 digits");
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ pin_hash: hashPin(pin, userId) })
    .eq("id", userId);
  if (error) throw new Error(`setProfilePin: ${error.message}`);
}

export async function verifyProfilePin(
  email: string,
  pin: string
): Promise<Profile | null> {
  const profile = await getProfileByEmail(email);
  if (!profile?.pin_hash) return null;
  if (profile.pin_hash !== hashPin(pin, profile.id)) return null;
  return profile;
}

export async function sendSignInEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Reseller Assistant <noreply@mvfeed.us>";

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
    {
      from,
      to: [to],
      subject: "Your Reseller Assistant sign-in code",
      html: `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#F7F4EF;font-family:Georgia,serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F4EF;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E5DFD4;">
            <tr>
              <td style="text-align:center;">
                <p style="margin:0 0 8px;color:#1F5C4A;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Reseller Assistant</p>
                <h1 style="margin:0 0 16px;color:#1A1A1A;font-size:28px;line-height:1.2;">Your sign-in code</h1>
                <p style="margin:0 0 24px;color:#5C564C;font-size:18px;line-height:1.5;">Use this code to sign in:</p>
                <p style="margin:0 0 28px;font-size:40px;letter-spacing:0.25em;font-weight:700;color:#1F5C4A;font-family:ui-monospace,Consolas,monospace;">${code}</p>
                <p style="margin:0;color:#5C564C;font-size:16px;line-height:1.5;">This code expires in 10 minutes. If you did not ask for it, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      text: `Your Reseller Assistant sign-in code is ${code}. It expires in 10 minutes.`,
    },
    { idempotencyKey: `signin-otp/${to}/${code}` }
  );

  if (error) {
    throw new Error(error.message || "Failed to send email");
  }
}
