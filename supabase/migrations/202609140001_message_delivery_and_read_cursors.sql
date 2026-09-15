-- Reliable delivery and monotonic per-user read state.
-- This migration is additive: the legacy messages.read_by column remains available
-- while deployed clients move to room_read_cursors.

lock table public.messages in share row exclusive mode;

create sequence if not exists public.messages_delivery_sequence;

alter table public.messages
  add column if not exists client_message_id uuid,
  add column if not exists sequence_no bigint;

with sequence_base as (
  select coalesce(max(sequence_no), 0) as value
  from public.messages
),
missing_sequences as (
  select
    messages.id,
    sequence_base.value + row_number() over (
      order by messages.created_at asc, messages.id asc
    ) as value
  from public.messages
  cross join sequence_base
  where messages.sequence_no is null
)
update public.messages as messages
set sequence_no = missing_sequences.value
from missing_sequences
where messages.id = missing_sequences.id;

select setval(
  'public.messages_delivery_sequence',
  greatest(coalesce((select max(sequence_no) from public.messages), 0), 1),
  exists(select 1 from public.messages)
);

alter table public.messages
  alter column sequence_no set default nextval('public.messages_delivery_sequence'),
  alter column sequence_no set not null;

alter sequence public.messages_delivery_sequence owned by public.messages.sequence_no;

create unique index if not exists messages_sequence_no_uidx
  on public.messages(sequence_no);

create unique index if not exists messages_sender_client_message_uidx
  on public.messages(user_id, client_message_id)
  where client_message_id is not null;

create index if not exists messages_room_sequence_idx
  on public.messages(room_id, sequence_no);

create table if not exists public.room_read_cursors (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_sequence bigint not null default 0 check (last_read_sequence >= 0),
  last_read_message_id uuid references public.messages(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_read_cursors_user_updated_idx
  on public.room_read_cursors(user_id, updated_at desc);

alter table public.room_read_cursors enable row level security;

drop policy if exists "Room members can view read cursors" on public.room_read_cursors;
create policy "Room members can view read cursors"
on public.room_read_cursors for select to authenticated
using (
  exists (
    select 1
    from public.room_members
    where room_members.room_id = room_read_cursors.room_id
      and room_members.user_id = auth.uid()
  )
);

revoke all on public.room_read_cursors from anon, authenticated;
grant select on public.room_read_cursors to authenticated;

insert into public.room_read_cursors (
  room_id,
  user_id,
  last_read_sequence,
  last_read_message_id,
  updated_at
)
select distinct on (messages.room_id, room_members.user_id)
  messages.room_id,
  room_members.user_id,
  messages.sequence_no,
  messages.id,
  now()
from public.messages as messages
cross join lateral unnest(coalesce(messages.read_by, '{}'::text[])) as readers(user_id)
join public.room_members
  on room_members.room_id = messages.room_id
 and room_members.user_id::text = readers.user_id
order by messages.room_id, room_members.user_id, messages.sequence_no desc
on conflict (room_id, user_id) do update
set
  last_read_sequence = greatest(
    room_read_cursors.last_read_sequence,
    excluded.last_read_sequence
  ),
  last_read_message_id = case
    when excluded.last_read_sequence > room_read_cursors.last_read_sequence
      then excluded.last_read_message_id
    else room_read_cursors.last_read_message_id
  end,
  updated_at = greatest(room_read_cursors.updated_at, excluded.updated_at);

create or replace function public.send_room_message(
  p_room_id uuid,
  p_client_message_id uuid,
  p_character_id uuid,
  p_type text,
  p_content text
)
returns public.messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  existing_message public.messages%rowtype;
  inserted_message public.messages%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_client_message_id is null then
    raise exception 'client_message_id is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.user_id = caller_id
  ) then
    raise exception 'room membership required' using errcode = '42501';
  end if;

  if p_type not in (
    'chat',
    'narration',
    'image',
    'image_group',
    'chapter',
    'member_joined',
    'member_left',
    'room_invite',
    'communication',
    'scene_transition',
    'random_result'
  ) then
    raise exception 'unsupported message type' using errcode = '22023';
  end if;

  if p_content is null or char_length(p_content) = 0 or char_length(p_content) > 200000 then
    raise exception 'message content length is invalid' using errcode = '22023';
  end if;

  if p_character_id is not null and not exists (
    select 1
    from public.characters
    where characters.id = p_character_id
      and characters.user_id = caller_id
      and characters.is_archived = false
  ) then
    raise exception 'character ownership required' using errcode = '42501';
  end if;

  select *
  into existing_message
  from public.messages
  where messages.user_id = caller_id
    and messages.client_message_id = p_client_message_id;

  if found then
    if existing_message.room_id <> p_room_id then
      raise exception 'client_message_id already belongs to another room' using errcode = '23505';
    end if;
    return existing_message;
  end if;

  insert into public.messages (
    room_id,
    user_id,
    character_id,
    type,
    content,
    client_message_id
  )
  values (
    p_room_id,
    caller_id,
    p_character_id,
    p_type,
    p_content,
    p_client_message_id
  )
  on conflict (user_id, client_message_id)
    where client_message_id is not null
    do nothing
  returning * into inserted_message;

  if inserted_message.id is not null then
    return inserted_message;
  end if;

  select *
  into existing_message
  from public.messages
  where messages.user_id = caller_id
    and messages.client_message_id = p_client_message_id;

  if existing_message.id is null then
    raise exception 'message could not be persisted' using errcode = '40001';
  end if;

  return existing_message;
end;
$$;

revoke all on function public.send_room_message(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.send_room_message(uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.advance_room_read_cursor(
  p_room_id uuid,
  p_message_id uuid
)
returns public.room_read_cursors
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  target_sequence bigint;
  result public.room_read_cursors%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.user_id = caller_id
  ) then
    raise exception 'room membership required' using errcode = '42501';
  end if;

  select messages.sequence_no
  into target_sequence
  from public.messages
  where messages.id = p_message_id
    and messages.room_id = p_room_id;

  if target_sequence is null then
    raise exception 'message does not belong to room' using errcode = '22023';
  end if;

  insert into public.room_read_cursors (
    room_id,
    user_id,
    last_read_sequence,
    last_read_message_id,
    updated_at
  )
  values (
    p_room_id,
    caller_id,
    target_sequence,
    p_message_id,
    now()
  )
  on conflict (room_id, user_id) do update
  set
    last_read_sequence = greatest(
      room_read_cursors.last_read_sequence,
      excluded.last_read_sequence
    ),
    last_read_message_id = case
      when excluded.last_read_sequence > room_read_cursors.last_read_sequence
        then excluded.last_read_message_id
      else room_read_cursors.last_read_message_id
    end,
    updated_at = case
      when excluded.last_read_sequence > room_read_cursors.last_read_sequence
        then excluded.updated_at
      else room_read_cursors.updated_at
    end
  returning * into result;

  return result;
end;
$$;

revoke all on function public.advance_room_read_cursor(uuid, uuid) from public, anon;
grant execute on function public.advance_room_read_cursor(uuid, uuid) to authenticated;

do $$
begin
  if exists (
    select 1
    from public.room_members
    group by room_id, user_id
    having count(*) > 1
  ) then
    raise exception 'duplicate room memberships must be resolved before Goal A migration';
  end if;
end $$;

create unique index if not exists room_members_room_user_uidx
  on public.room_members(room_id, user_id);

create or replace function public.find_room_by_invite_code(p_invite_code text)
returns setof public.rooms
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select rooms.*
  from public.rooms
  where auth.uid() is not null
    and rooms.invite_code = trim(p_invite_code);
$$;

revoke all on function public.find_room_by_invite_code(text) from public, anon;
grant execute on function public.find_room_by_invite_code(text) to authenticated;

create or replace function public.join_room_with_invite(
  p_invite_code text,
  p_character_id uuid,
  p_client_message_id uuid
)
returns setof public.rooms
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  selected_room public.rooms%rowtype;
  character_name text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select rooms.* into selected_room
  from public.rooms
  where rooms.invite_code = trim(p_invite_code)
  for update;

  if selected_room.id is null then
    raise exception 'invalid invite code' using errcode = '22023';
  end if;

  select characters.name into character_name
  from public.characters
  where characters.id = p_character_id
    and characters.user_id = caller_id
    and characters.is_archived = false;

  if character_name is null then
    raise exception 'active owned character required' using errcode = '42501';
  end if;

  insert into public.room_members (
    room_id,
    user_id,
    sort_order,
    last_char_id
  )
  values (
    selected_room.id,
    caller_id,
    (select count(*) from public.room_members where user_id = caller_id),
    p_character_id
  )
  on conflict (room_id, user_id) do update
  set last_char_id = excluded.last_char_id;

  insert into public.room_characters (
    room_id,
    user_id,
    character_id,
    sort_order
  )
  values (selected_room.id, caller_id, p_character_id, 0)
  on conflict (room_id, user_id, character_id) do nothing;

  if p_client_message_id is not null then
    insert into public.messages (
      room_id,
      user_id,
      character_id,
      type,
      content,
      client_message_id
    )
    values (
      selected_room.id,
      caller_id,
      p_character_id,
      'member_joined',
      character_name || '님이 대화방에 들어왔어요.',
      p_client_message_id
    )
    on conflict (user_id, client_message_id)
      where client_message_id is not null
      do nothing;
  end if;

  return next selected_room;
end;
$$;

revoke all on function public.join_room_with_invite(text, uuid, uuid) from public, anon;
grant execute on function public.join_room_with_invite(text, uuid, uuid) to authenticated;

comment on column public.messages.client_message_id is
  'Client-generated idempotency key, unique per sender.';
comment on column public.messages.sequence_no is
  'Server-assigned stable ordering key used for reconciliation and read cursors.';
comment on table public.room_read_cursors is
  'Monotonic per-user read position. Direct writes are intentionally disabled.';
