# Reseller Assistant

Easy coach for listing clothing on **Mercari** and **Poshmark**.

Phone takes guided photos → laptop reviews the AI draft → checklist (or Chrome extension) helps you post.

Live app: **https://reseller-assistant.vercel.app** (custom domain **https://reseller.mvfeed.us** once DNS is set)

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Supabase (Postgres + Storage + Auth)
- Passwordless sign-in: email one-time code (Resend), or your own PIN
- Optional OpenRouter (or OpenAI) vision/drafting and Clean bg via PhotoRoom / Pixelcut

## Auth email (Resend)

Sign-in codes for **email** are sent through **Resend** on domain `mvfeed.us`
(`Reseller Assistant <noreply@mvfeed.us>`).

Required env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SESSION_SECRET`.

Optional (Supabase Auth Send Email hook / Edge Function `auth-send-email`):
`SEND_EMAIL_HOOK_SECRET` — only needed if you also enable the Supabase Auth hook.


2. Copy env file and fill secrets (`.env.example` → `.env.local`).

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → email code sign-in (or email + PIN after you set one).

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | no* | Prefer service role in production |
| `SESSION_SECRET` | yes | Signs temporary QR phone-join cookies |
| `NEXT_PUBLIC_APP_URL` | yes | Canonical URL for redirects |
| `OPENROUTER_API_KEY` | no | Preferred AI key (Gemini identify + GPT draft via OpenRouter) |
| `OPENROUTER_IDENTIFY_MODEL` | no | Default `google/gemini-2.5-pro` |
| `OPENROUTER_DRAFT_MODEL` | no | Default `openai/gpt-4o` |
| `OPENAI_API_KEY` | no | Fallback if OpenRouter is unset |
| `FAL_KEY` | no* | Pixelcut / BiRefNet Clean bg when PhotoRoom is unset |
| `PHOTOROOM_API_KEY` | no* | Preferred Clean bg (PhotoRoom quality for clothing) |
| `ADMIN_EMAILS` | no | Comma-separated emails for `/app/admin/bg-lab` |

## Domain

Production custom domain: **https://reseller.mvfeed.us**

Until DNS propagates, use **https://reseller-assistant.vercel.app**. QR join links use the hostname you are currently on.

### Cloudflare DNS

| Type | Name | Target |
| --- | --- | --- |
| CNAME | `reseller` | `cname.vercel-dns.com` |

## Chrome extension

See [`extension/README.md`](extension/README.md).

## Main flows

1. **Sign in** with email code (or email + your PIN)
2. **Start listing** → choose Mercari or Poshmark
3. Scan the **QR** on the laptop hub to open the Phone Companion
4. Tag-first photos (brand/care optional) → item shots
5. **Finish with AI** on the hub
6. **Review** editable title/description/fields
7. **Post** checklist + extension pair → mark as posted

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
