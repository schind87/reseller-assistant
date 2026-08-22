# Reseller Assistant

Easy coach for listing clothing on **Mercari** and **Poshmark**.

Phone takes guided photos → laptop reviews the AI draft → checklist (or Chrome extension) helps you post.

Live app: **https://reseller.mvfeed.us**

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Supabase (Postgres + Storage + Auth)
- Passwordless sign-in: email one-time code (Resend), or your own PIN
- Optional OpenRouter (or OpenAI) vision/drafting and Clean bg via Pixelcut on fal

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
| `SESSION_SECRET` | yes in production | Signs seller session JWTs (`ra_session`, ~30 days) and QR phone-join cookies. Keep stable; rotating it signs everyone out. Do not reuse the Supabase anon key. |
| `NEXT_PUBLIC_APP_URL` | yes | Canonical public URL (`https://reseller.mvfeed.us` in production) |
| `OPENROUTER_API_KEY` | no | Preferred AI key (Gemini identify + GPT draft via OpenRouter) |
| `OPENROUTER_IDENTIFY_MODEL` | no | Default `google/gemini-2.5-pro` |
| `OPENROUTER_DRAFT_MODEL` | no | Default `openai/gpt-4o` |
| `OPENAI_API_KEY` | no | Fallback if OpenRouter is unset |
| `FAL_KEY` | no* | Pixelcut / BiRefNet Clean bg + AI Photo Lab inference |
| `FAL_ADMIN_KEY` | no | ADMIN-scoped fal key so AI Photo Lab can read actual billed costs |
| `ADMIN_EMAILS` | no | Comma-separated emails for `/app/admin/bg-lab` (AI Photo Lab) |

## Domain

Canonical production URL: **https://reseller.mvfeed.us**

Stable Vercel production aliases (`reseller-assistant.vercel.app` and the project/git-main `*.vercel.app` aliases) redirect there. Unique preview/deployment URLs are not redirected, so they stay usable for testing. QR and join links use the hostname of the current request, which is the canonical host for normal production traffic.

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
5. **Write listing with AI** on the hub
6. **Review** editable title/description/fields
7. **Post** checklist + extension pair → mark as posted

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
