-- Close the public Data API hole on background-lab tables.
-- All app access goes through createAdminClient() (service role).
-- No policies: anon/authenticated cannot read or mutate these rows.
alter table bg_lab_runs enable row level security;
alter table bg_lab_results enable row level security;
