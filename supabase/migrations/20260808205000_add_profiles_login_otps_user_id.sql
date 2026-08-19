-- Baseline auth tables required by the app that were previously provisioned
-- outside the migration set (profiles, login_otps) plus the listings.user_id
-- ownership column. Written idempotently so it is a no-op on databases where
-- these objects already exist (e.g. the hosted project).

create extension if not exists "pgcrypto";

-- Per-user account. Passwordless email OTP sign-in, optional PIN.
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  pin_hash text,
  created_at timestamptz not null default now()
);

-- Short-lived hashed one-time sign-in codes (email channel today).
create table if not exists login_otps (
  id uuid primary key default gen_random_uuid(),
  contact text not null,
  channel text not null default 'email',
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_otps_contact_idx on login_otps (contact);

-- Owner of a listing. Nullable to match existing rows / workspace fallback.
alter table listings
  add column if not exists user_id uuid;

create index if not exists listings_user_id_idx on listings (user_id);
