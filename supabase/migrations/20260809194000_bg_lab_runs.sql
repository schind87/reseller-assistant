-- Persist background model lab comparison runs + per-model results.
create table if not exists bg_lab_runs (
  id uuid primary key default gen_random_uuid(),
  listing_photo_id uuid not null references listing_photos (id) on delete cascade,
  listing_id uuid not null references listings (id) on delete cascade,
  run_by_user_id uuid,
  composite_white boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists bg_lab_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references bg_lab_runs (id) on delete cascade,
  model_id text not null,
  model_label text not null,
  provider text not null check (provider in ('fal', 'photoroom')),
  ok boolean not null default false,
  ms int not null default 0,
  storage_path text,
  fal_request_id text,
  fal_endpoint text,
  cost_usd numeric,
  cost_unit_price numeric,
  cost_units numeric,
  cost_currency text default 'USD',
  cost_source text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists bg_lab_runs_photo_created_idx
  on bg_lab_runs (listing_photo_id, created_at desc);
create index if not exists bg_lab_results_run_id_idx
  on bg_lab_results (run_id);
create index if not exists bg_lab_results_fal_request_idx
  on bg_lab_results (fal_request_id)
  where fal_request_id is not null;

-- Service-role admin client only. No anon/authenticated policies on purpose.
alter table bg_lab_runs enable row level security;
alter table bg_lab_results enable row level security;
