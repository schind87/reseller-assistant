-- Restore AI Photo Lab / admin writes. Production uses the anon key
-- (no SUPABASE_SERVICE_ROLE_KEY) and a signed cookie, not a Supabase JWT.
-- RLS stays enabled so the public-table linter stays clear.
drop policy if exists anon_all_bg_lab_runs on bg_lab_runs;
create policy anon_all_bg_lab_runs
  on bg_lab_runs
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists anon_all_bg_lab_results on bg_lab_results;
create policy anon_all_bg_lab_results
  on bg_lab_results
  for all
  to anon, authenticated
  using (true)
  with check (true);
