-- Tie lab runs to the exact listing-photo original (storage_path) so a re-crop
-- does not reuse AI results from a previous crop of the same photo row.
alter table bg_lab_runs
  add column if not exists source_storage_path text;

create index if not exists bg_lab_runs_photo_source_idx
  on bg_lab_runs (listing_photo_id, source_storage_path);
