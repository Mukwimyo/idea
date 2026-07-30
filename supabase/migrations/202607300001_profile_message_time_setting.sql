alter table public.profiles
  add column if not exists show_message_time boolean not null default true;
