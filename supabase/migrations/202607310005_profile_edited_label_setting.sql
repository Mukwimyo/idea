alter table public.profiles
  add column if not exists show_edited_label boolean not null default true;
