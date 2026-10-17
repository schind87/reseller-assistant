-- One-row table the keep-alive ping writes so Free-plan inactivity
-- counts real user database activity (not /auth/v1/health).
create table if not exists public.project_keepalive (
  id integer primary key check (id = 1),
  last_ping timestamptz not null default now()
);

insert into public.project_keepalive (id, last_ping)
values (1, now())
on conflict (id) do nothing;

alter table public.project_keepalive enable row level security;

drop policy if exists anon_all_project_keepalive on public.project_keepalive;
create policy anon_all_project_keepalive
  on public.project_keepalive
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update on table public.project_keepalive
  to anon, authenticated, service_role;
