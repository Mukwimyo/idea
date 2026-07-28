alter table public.characters
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at, id
    ) - 1 as position
  from public.characters
)
update public.characters as characters
set sort_order = ranked.position
from ranked
where characters.id = ranked.id
  and characters.sort_order = 0;

create table if not exists public.room_characters (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, character_id)
);

create index if not exists room_characters_user_room_order_idx
  on public.room_characters(user_id, room_id, sort_order);

alter table public.room_characters enable row level security;

drop policy if exists "Users can view their room character pools" on public.room_characters;
create policy "Users can view their room character pools"
on public.room_characters
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can add characters to their rooms" on public.room_characters;
create policy "Users can add characters to their rooms"
on public.room_characters
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.room_members
    where room_members.room_id = room_characters.room_id
      and room_members.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.characters
    where characters.id = room_characters.character_id
      and characters.user_id = auth.uid()
      and characters.is_archived = false
  )
);

drop policy if exists "Users can reorder their room character pools" on public.room_characters;
create policy "Users can reorder their room character pools"
on public.room_characters
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can remove characters from their rooms" on public.room_characters;
create policy "Users can remove characters from their rooms"
on public.room_characters
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.room_characters to authenticated;
