create table if not exists public.message_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index if not exists message_bookmarks_user_room_created_idx
  on public.message_bookmarks(user_id, room_id, created_at desc);

alter table public.message_bookmarks enable row level security;

drop policy if exists "Users can view own message bookmarks" on public.message_bookmarks;
create policy "Users can view own message bookmarks"
on public.message_bookmarks for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Room members can bookmark messages" on public.message_bookmarks;
create policy "Room members can bookmark messages"
on public.message_bookmarks for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.room_members
    where room_members.room_id = message_bookmarks.room_id
      and room_members.user_id = auth.uid()
  )
  and exists (
    select 1 from public.messages
    where messages.id = message_bookmarks.message_id
      and messages.room_id = message_bookmarks.room_id
  )
);

drop policy if exists "Users can delete own message bookmarks" on public.message_bookmarks;
create policy "Users can delete own message bookmarks"
on public.message_bookmarks for delete to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on public.message_bookmarks to authenticated;
