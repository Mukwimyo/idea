alter table public.room_members
  add column if not exists sort_order integer not null default 0;

create index if not exists room_members_user_sort_order_idx
  on public.room_members(user_id, sort_order);
