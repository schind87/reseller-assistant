import { createHash, randomInt } from "crypto";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export async function storeLoginOtp(
  contact: string,
  channel: "email" | "phone",
  code: string,
  ttlMinutes = 10
): Promise<void> {
  const supabase = createAdminClient();
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const { error } = await supabase.from("login_otps").insert({
    contact,
    channel,
    code_hash: hashOtpCode(code),
    expires_at: expires,
  });
  if (error) throw new Error(`storeLoginOtp: ${error.message}`);
}

export async function consumeLoginOtp(
  contact: string,
  code: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("login_otps")
    .select("*")
    .eq("contact", contact)
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

export async function upsertProfile(opts: {
  email?: string;
  phone?: string;
}): Promise<{ id: string; email: string | null; phone: string | null }> {
  const supabase = createAdminClient();

  if (opts.email) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", opts.email)
      .maybeSingle();
    if (existing) {
      return {
        id: existing.id as string,
        email: existing.email as string | null,
        phone: existing.phone as string | null,
      };
    }
    const { data, error } = await supabase
      .from("profiles")
      .insert({ email: opts.email })
      .select("*")
      .single();
    if (error) throw new Error(`upsertProfile email: ${error.message}`);
    return {
      id: data.id as string,
      email: data.email as string | null,
      phone: data.phone as string | null,
    };
  }

  if (opts.phone) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", opts.phone)
      .maybeSingle();
    if (existing) {
      return {
        id: existing.id as string,
        email: existing.email as string | null,
        phone: existing.phone as string | null,
      };
    }
    const { data, error } = await supabase
      .from("profiles")
      .insert({ phone: opts.phone })
      .select("*")
      .single();
    if (error) throw new Error(`upsertProfile phone: ${error.message}`);
    return {
      id: data.id as string,
      email: data.email as string | null,
      phone: data.phone as string | null,
    };
  }

  throw new Error("email or phone required");
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
