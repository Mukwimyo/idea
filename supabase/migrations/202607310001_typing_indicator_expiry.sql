alter table public.room_members
  add column if not exists typing_expires_at timestamptz;

alter table public.rooms
  add column if not exists show_typing_indicator boolean not null default true;

update public.room_members
set is_typing = false,
    typing_char_name = null,
    typing_expires_at = null
where is_typing = true;
