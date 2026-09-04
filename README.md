# Reseller Assistant

Easy coach for listing clothing on **Mercari** and **Poshmark**.

Phone takes guided photos → laptop reviews the AI draft → checklist (or Chrome extension) helps you post.

Live app: **https://reseller.mvfeed.us**

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Supabase (Postgres + Auth)
- Cloudflare R2 for listing photos (private bucket, presigned URLs). Local/dev can keep using the Supabase `listing-photos` bucket when R2 env vars are unset.
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
| `ADMIN_EMAILS` | no | Comma-separated emails for `/app/admin/*` (AI Photo Lab, Users) |
| `R2_ACCOUNT_ID` | prod* | Cloudflare account ID. Required with the other `R2_*` vars to store listing photos on R2 |
| `R2_ACCESS_KEY_ID` | prod* | R2 S3 API token access key |
| `R2_SECRET_ACCESS_KEY` | prod* | R2 S3 API token secret |
| `R2_BUCKET_NAME` | prod* | Private R2 bucket (example: `listing-photos`). Standard storage, not Infrequent Access |
| `R2_ENDPOINT` | no | Defaults to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` |

\*Photos stay on the Supabase `listing-photos` bucket until all four `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` (or `R2_BUCKET`) values are set. After they are set, new uploads go to R2 and reads try R2 first, then Supabase.

Copy existing production objects from **Users** (`/app/admin/users`): **Copy listing photos to R2**. That runs on Vercel with the production `R2_*` vars and does not delete Supabase originals.

Or run locally:

```bash
npm run photos:migrate-r2 -- --dry-run
npm run photos:migrate-r2
```

The script needs the same `R2_*` vars plus `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It does not delete Supabase originals unless you pass `--delete-source`.

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
8. **Profile → Linked closets** — **Find my closet** (Chrome helper reads the signed-in store, then you confirm) or paste a username, then **Check listings**

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm run photos:migrate-r2` — copy Supabase `listing-photos` objects to R2 (`--dry-run`, `--skip-thumbs`, `--delete-source`)
