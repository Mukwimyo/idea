create table if not exists public.communication_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  kind text not null check (kind in ('call', 'text')),
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  receiver_character_id uuid not null references public.characters(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  receiver_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing', 'active', 'declined', 'left', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.communication_session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.communication_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists communication_sessions_room_created_idx
  on public.communication_sessions(room_id, created_at);

create index if not exists communication_session_messages_session_created_idx
  on public.communication_session_messages(session_id, created_at);

alter table public.communication_sessions enable row level security;
alter table public.communication_session_messages enable row level security;

drop policy if exists "Room members can view communication sessions" on public.communication_sessions;
create policy "Room members can view communication sessions"
on public.communication_sessions for select to authenticated
using (
  exists (
    select 1 from public.room_members
    where room_members.room_id = communication_sessions.room_id
      and room_members.user_id = auth.uid()
  )
);

drop policy if exists "Room members can start communication sessions" on public.communication_sessions;
create policy "Room members can start communication sessions"
on public.communication_sessions for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and receiver_user_id <> auth.uid()
  and exists (
    select 1 from public.room_members
    where room_members.room_id = communication_sessions.room_id
      and room_members.user_id = auth.uid()
  )
  and exists (
    select 1 from public.characters
    where characters.id = communication_sessions.sender_character_id
      and characters.user_id = auth.uid()
  )
);

drop policy if exists "Participants can update communication sessions" on public.communication_sessions;
create policy "Participants can update communication sessions"
on public.communication_sessions for update to authenticated
using (auth.uid() in (sender_user_id, receiver_user_id))
with check (auth.uid() in (sender_user_id, receiver_user_id));

drop policy if exists "Room members can view communication messages" on public.communication_session_messages;
create policy "Room members can view communication messages"
on public.communication_session_messages for select to authenticated
using (
  exists (
    select 1 from public.communication_sessions
    join public.room_members on room_members.room_id = communication_sessions.room_id
    where communication_sessions.id = communication_session_messages.session_id
      and room_members.user_id = auth.uid()
  )
);

drop policy if exists "Participants can send communication messages" on public.communication_session_messages;
create policy "Participants can send communication messages"
on public.communication_session_messages for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.communication_sessions
    where communication_sessions.id = communication_session_messages.session_id
      and communication_sessions.status = 'active'
      and auth.uid() in (communication_sessions.sender_user_id, communication_sessions.receiver_user_id)
  )
);

drop policy if exists "Room members can view room character pools" on public.room_characters;
create policy "Room members can view room character pools"
on public.room_characters for select to authenticated
using (
  exists (
    select 1 from public.room_members
    where room_members.room_id = room_characters.room_id
      and room_members.user_id = auth.uid()
  )
);

grant select, insert, update on public.communication_sessions to authenticated;
grant select, insert on public.communication_session_messages to authenticated;

drop policy if exists "Room members can view shared room characters" on public.characters;
create policy "Room members can view shared room characters"
on public.characters for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.room_characters
    join public.room_members
      on room_members.room_id = room_characters.room_id
    where room_characters.character_id = characters.id
      and room_members.user_id = auth.uid()
  )
);

do $$
begin
  alter publication supabase_realtime add table public.communication_sessions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.communication_session_messages;
exception
  when duplicate_object then null;
end $$;
