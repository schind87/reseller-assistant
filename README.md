# Reseller Assistant

Household-friendly coach for listing clothing on **Mercari** and **Poshmark**.

Phone takes guided photos → laptop reviews the AI draft → checklist (or Chrome extension) helps you post.

Live app URL: **https://reseller.mvfeed.us**

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Supabase (Postgres + Storage)
- Household PIN session cookie (`ra_session`, 7 days)
- Optional OpenAI vision/drafting and fal.ai background removal

## Setup

1. Copy env file and fill secrets:

```bash
cp .env.example .env.local
```

2. Apply the SQL in [`supabase/migrations/20260808160000_init.sql`](supabase/migrations/20260808160000_init.sql) to your Supabase project (SQL editor or CLI).

3. Create a private Storage bucket named `listing-photos`.

4. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → unlock with `HOUSEHOLD_PIN` (default suggestion `1234`).

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | e.g. `https://gcmbimhkpcilnccrkzlj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | no* | Prefer service role in production; anon key works if RLS allows household access |
| `HOUSEHOLD_PIN` | yes | Shared unlock code (suggest `1234` for local) |
| `SESSION_SECRET` | yes | Long random string for signing cookies |
| `NEXT_PUBLIC_APP_URL` | yes | `https://reseller.mvfeed.us` in production |
| `OPENAI_API_KEY` | no | Without it, identify/draft return editable templates |
| `FAL_KEY` | no | Without it, background removal is skipped |

## Domain

Production custom domain: **https://reseller.mvfeed.us** (same pattern as `starloom.mvfeed.us` / `tasks.mvfeed.us`).

Until DNS propagates, use **https://reseller-assistant.vercel.app**. QR join links use the hostname you are currently on.

### Cloudflare DNS (required for reseller.mvfeed.us)

In Cloudflare for `mvfeed.us`, add a **CNAME** (DNS only / grey cloud):

| Type | Name | Target |
| --- | --- | --- |
| CNAME | `reseller` | `cname.vercel-dns.com` |

Match the setup used for `starloom.mvfeed.us`.

## Chrome extension

The Manifest V3 extension lives in [`extension/`](extension/).

1. Open Chrome → Extensions → Developer mode → **Load unpacked**
2. Select the `extension/` folder
3. On a listing’s Post screen, pair with the QR / 6-character code
4. Open Mercari or Poshmark sell pages; use the side panel to autofill

The extension calls `GET /api/listings/:id/extension` with a Bearer join token or session cookie.

## Main flows

1. **Unlock** once with the household PIN
2. **Start listing** → choose Mercari or Poshmark
3. Scan the **QR** on the laptop hub to open the phone photo coach
4. Tag-first photos (brand/care optional) → item shots
5. **Finish with AI** on the hub (identify + draft + optional BG remove)
6. **Review** editable title/description/fields
7. **Post** checklist + extension pair → mark as posted

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
