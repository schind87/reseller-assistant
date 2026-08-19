-- Local-development seed (runs on `supabase start` / `supabase db reset`).
-- Creates the private Storage bucket the app expects. On the hosted project
-- this bucket is created via the Supabase dashboard instead.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', false)
on conflict (id) do nothing;

-- The server talks to Postgres with the service_role key (RLS bypassed) and,
-- as a fallback, the anon key. A fresh local database does not grant DML on
-- migration-created public tables to these roles, so grant it here for local
-- dev. (The hosted project already carries these grants.)
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
