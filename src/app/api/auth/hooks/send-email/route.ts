import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Webhook } from "standardwebhooks";

type SendEmailHookPayload = {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
};

function subjectFor(action: string): string {
  switch (action) {
    case "signup":
    case "invite":
    case "magiclink":
    case "email":
      return "Your Reseller Assistant sign-in code";
    case "recovery":
      return "Your Reseller Assistant reset code";
    case "email_change":
      return "Confirm your new email";
    default:
      return "Your Reseller Assistant code";
  }
}

function htmlBody(token: string, action: string): string {
  const intro =
    action === "recovery"
      ? "Use this code to reset access:"
      : "Use this code to sign in:";

  return `<!DOCTYPE html>
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
                <p style="margin:0 0 24px;color:#5C564C;font-size:18px;line-height:1.5;">${intro}</p>
                <p style="margin:0 0 28px;font-size:40px;letter-spacing:0.25em;font-weight:700;color:#1F5C4A;font-family:ui-monospace,Consolas,monospace;">${token}</p>
                <p style="margin:0;color:#5C564C;font-size:16px;line-height:1.5;">This code expires soon. If you did not ask for it, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Supabase Auth "Send Email" hook → Resend.
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email
 * pointing to: https://<your-host>/api/auth/hooks/send-email
 */
export async function POST(request: Request) {
  const hookSecret = process.env.SEND_EMAIL_HOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL || "Reseller Assistant <noreply@mvfeed.us>";

  if (!hookSecret || !resendKey) {
    console.error("Missing SEND_EMAIL_HOOK_SECRET or RESEND_API_KEY");
    return NextResponse.json(
      { error: { message: "Email hook not configured" } },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  try {
    const base64Secret = hookSecret.replace(/^v1,whsec_/, "");
    const wh = new Webhook(base64Secret);
    const verified = wh.verify(payload, headers) as SendEmailHookPayload;

    const email = verified.user?.email;
    const token = verified.email_data?.token;
    const action = verified.email_data?.email_action_type || "magiclink";

    if (!email || !token) {
      return NextResponse.json(
        { error: { message: "Missing email or token in hook payload" } },
        { status: 400 }
      );
    }

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send(
      {
        from,
        to: [email],
        subject: subjectFor(action),
        html: htmlBody(token, action),
        text: `Your Reseller Assistant code is ${token}`,
      },
      {
        idempotencyKey: `auth-otp/${email}/${token}/${action}`,
      }
    );

    if (error) {
      console.error("Resend send error:", error);
      return NextResponse.json(
        {
          error: {
            http_code: 500,
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("send-email hook error:", err);
    return NextResponse.json(
      {
        error: {
          http_code: 401,
          message: err instanceof Error ? err.message : "Hook verification failed",
        },
      },
      { status: 401 }
    );
  }
}
