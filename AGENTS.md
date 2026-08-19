<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Reseller Assistant is a single Next.js 16 app (App Router, Turbopack) backed by
Supabase (Postgres + Storage). Everything server-side goes through the Supabase
**service role** client, so a running Supabase instance is required for auth,
listings, and photos. AI (OpenRouter/OpenAI) and email OTP (Resend) are optional
and degrade gracefully when their keys are absent.

Standard scripts live in `package.json` (`dev`, `build`, `lint`). `npm run dev`
first syncs `extension/` → `extension-live/` then runs `next dev` on port 3000.

### Local backend (Docker + Supabase CLI are pre-installed in the snapshot)

Docker and the `supabase` CLI are installed, but the Docker daemon and the
Supabase stack are **not** auto-started (they are intentionally kept out of the
`npm install` update script). Bring them up once per VM boot:

```bash
sudo dockerd >/tmp/dockerd.log 2>&1 &   # wait a few seconds
supabase start                          # applies migrations + supabase/seed.sql
```

`supabase start` prints the local URL/keys. Create `.env.local` (gitignored) with
the local stack's well-known demo keys (non-secret) so the app connects:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase start`/`supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase start`/`supabase status`>
SESSION_SECRET=<any long random string>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Non-obvious gotchas:
- The committed migrations alone did **not** provision `profiles`, `login_otps`,
  or `listings.user_id` (they were created outside migrations on the hosted
  project). Migration `20260808205000_add_profiles_login_otps_user_id.sql` fills
  that gap idempotently. `supabase/seed.sql` additionally creates the private
  `listing-photos` Storage bucket and grants DML on public tables to
  `anon`/`authenticated`/`service_role` — a fresh local DB does not grant those,
  so without the seed every query fails with `permission denied`. If you change
  schema/seed, apply with `supabase db reset`.
- Email OTP sign-in needs `RESEND_API_KEY`. Without it, sign in with **email +
  PIN** instead. Seed a PIN account directly (PIN hash =
  `sha256("reseller-assistant-pin:<profile.id>:<pin>")`), e.g.:
  ```bash
  UID=00000000-0000-0000-0000-0000000000aa; PIN=2468
  H=$(printf "reseller-assistant-pin:%s:%s" "$UID" "$PIN" | sha256sum | awk '{print $1}')
  docker exec -i supabase_db_workspace psql -U postgres -d postgres -c \
    "insert into profiles(id,email,pin_hash,listing_prefs_completed_at) values('$UID','demo@reseller.local','$H',now()) on conflict (id) do update set pin_hash=excluded.pin_hash;"
  ```
  Then sign in at `/unlock` with `demo@reseller.local` / `2468`.
- `createAdminClient()` memoizes the Supabase client for the process lifetime;
  changing Supabase env vars requires restarting `next dev`.
