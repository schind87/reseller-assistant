-- Thumbs up/down quality ratings for bg lab model results.
alter table bg_lab_results
  add column if not exists rating text
    check (rating is null or rating in ('up', 'down'));

create index if not exists bg_lab_results_model_rating_idx
  on bg_lab_results (model_id, rating)
  where rating is not null;
