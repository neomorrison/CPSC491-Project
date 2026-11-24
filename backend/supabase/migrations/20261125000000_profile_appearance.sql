-- profiles.avatar_id and profiles.frame_id (used by the Appearance screen) were added to the
-- live database by hand, so they weren't in any migration and a fresh or local database
-- didn't have them. "if not exists" adds them there and does nothing on the live database.

alter table public.profiles
  add column if not exists avatar_id text not null default 'initials',
  add column if not exists frame_id  text not null default 'minimal';
