-- Listing photo role for shopper-facing tag close-ups.
alter table listing_photos drop constraint if exists listing_photos_role_check;

alter table listing_photos
  add constraint listing_photos_role_check
  check (role in (
    'brand_tag',
    'care_tag',
    'id_tag',
    'inventory',
    'cover',
    'front',
    'back',
    'detail',
    'tag',
    'flaw'
  ));
