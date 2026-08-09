-- Opt-in clean/studio background replacement per listing photo.
alter table listing_photos
  add column if not exists replace_background boolean not null default false;

comment on column listing_photos.replace_background is
  'When true, AI processing replaces the photo background (keeping hangers intact).';
