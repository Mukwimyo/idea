alter table public.profiles
  add column if not exists hide_message_bubbles boolean not null default false;
