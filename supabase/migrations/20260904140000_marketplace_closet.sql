-- Linked Mercari / Poshmark closets and a cache of listings checked from those stores.
create table if not exists marketplace_accounts (
  user_id uuid not null references profiles (id) on delete cascade,
  platform text not null check (platform in ('mercari', 'poshmark')),
  username text not null,
  linked_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_check_error text,
  primary key (user_id, platform)
);

create table if not exists marketplace_closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  platform text not null check (platform in ('mercari', 'poshmark')),
  external_id text not null,
  title text,
  price numeric,
  status text not null default 'unknown'
    check (status in ('active', 'sold', 'reserved', 'not_for_sale', 'unknown')),
  url text not null,
  thumbnail_url text,
  synced_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create index if not exists marketplace_closet_items_user_platform_idx
  on marketplace_closet_items (user_id, platform, synced_at desc);

-- RLS stays on (Data API linter). The Next.js server uses the anon key
-- with a signed-cookie session, so policies match the rest of the household app.
alter table marketplace_accounts enable row level security;
alter table marketplace_closet_items enable row level security;

drop policy if exists anon_all_marketplace_accounts on marketplace_accounts;
create policy anon_all_marketplace_accounts
  on marketplace_accounts
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists anon_all_marketplace_closet_items on marketplace_closet_items;
create policy anon_all_marketplace_closet_items
  on marketplace_closet_items
  for all
  to anon, authenticated
  using (true)
  with check (true);
