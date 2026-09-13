-- Closet linking writes marketplace_accounts through createAdminClient().
-- Production uses the anon key (no SUPABASE_SERVICE_ROLE_KEY) and a signed
-- cookie, not a Supabase JWT. RLS stayed on with no policies, so Link closet
-- failed with "new row violates row-level security policy".
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
