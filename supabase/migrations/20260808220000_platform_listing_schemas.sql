-- Cached marketplace sell-form schemas (seed defaults + extension discoveries).
create table if not exists platform_listing_schemas (
  platform text primary key check (platform in ('mercari', 'poshmark')),
  version int not null default 1,
  sell_page_url text not null,
  source text not null check (source in ('seed', 'extension')),
  fields jsonb not null default '[]'::jsonb,
  synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table platform_listing_schemas enable row level security;
