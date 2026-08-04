alter table public.room_members
add column if not exists is_favorite boolean not null default false;
