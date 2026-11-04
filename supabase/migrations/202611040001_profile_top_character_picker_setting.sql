alter table public.profiles
  add column if not exists top_character_picker boolean not null default false;
