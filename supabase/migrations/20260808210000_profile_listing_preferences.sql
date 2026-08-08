-- Per-user seller preferences for AI listing drafts / onboarding.
alter table profiles
  add column if not exists listing_preferences jsonb not null default '{}'::jsonb,
  add column if not exists listing_prefs_completed_at timestamptz;
