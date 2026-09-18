-- Personal room groups organize each user's room list without changing the
-- shared room itself. Existing memberships remain unassigned (NULL).

create table if not exists public.room_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists room_groups_user_name_uidx
  on public.room_groups(user_id, lower(trim(name)));

create index if not exists room_groups_user_order_idx
  on public.room_groups(user_id, sort_order, created_at);

alter table public.room_groups enable row level security;

drop policy if exists "Users manage own room groups" on public.room_groups;
create policy "Users manage own room groups"
on public.room_groups for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.room_groups to authenticated;

alter table public.room_members
  add column if not exists room_group_id uuid references public.room_groups(id) on delete set null;

create index if not exists room_members_user_group_order_idx
  on public.room_members(user_id, room_group_id, sort_order);

create or replace function public.protect_room_member_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'room membership identity is immutable' using errcode = '42501';
  end if;

  if new.room_group_id is not null and not exists (
    select 1
    from public.room_groups
    where room_groups.id = new.room_group_id
      and room_groups.user_id = new.user_id
  ) then
    raise exception 'room group ownership required' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_room_member_identity on public.room_members;
create trigger protect_room_member_identity
before insert or update on public.room_members
for each row execute function public.protect_room_member_identity();

create or replace function public.create_room_in_group(
  p_name text,
  p_room_group_id uuid
)
returns setof public.rooms
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  created_room public.rooms%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 or char_length(trim(p_name)) > 120 then
    raise exception 'room name is invalid' using errcode = '22023';
  end if;

  if p_room_group_id is not null and not exists (
    select 1 from public.room_groups
    where room_groups.id = p_room_group_id
      and room_groups.user_id = caller_id
  ) then
    raise exception 'room group ownership required' using errcode = '42501';
  end if;

  insert into public.rooms (name, created_by)
  values (trim(p_name), caller_id)
  returning * into created_room;

  insert into public.room_members (
    room_id,
    user_id,
    sort_order,
    room_group_id
  )
  values (
    created_room.id,
    caller_id,
    (
      select count(*)
      from public.room_members
      where room_members.user_id = caller_id
        and room_members.room_group_id is not distinct from p_room_group_id
    ),
    p_room_group_id
  );

  return next created_room;
end;
$$;

revoke all on function public.create_room_in_group(text, uuid) from public, anon;
grant execute on function public.create_room_in_group(text, uuid) to authenticated;

create or replace function public.move_room_to_group(
  p_room_id uuid,
  p_room_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  next_sort_order integer;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_group_id is not null and not exists (
    select 1 from public.room_groups
    where room_groups.id = p_room_group_id
      and room_groups.user_id = caller_id
  ) then
    raise exception 'room group ownership required' using errcode = '42501';
  end if;

  select count(*)::integer into next_sort_order
  from public.room_members
  where room_members.user_id = caller_id
    and room_members.room_id <> p_room_id
    and room_members.room_group_id is not distinct from p_room_group_id;

  update public.room_members
  set
    room_group_id = p_room_group_id,
    sort_order = next_sort_order
  where room_members.room_id = p_room_id
    and room_members.user_id = caller_id;

  if not found then
    raise exception 'room membership required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.move_room_to_group(uuid, uuid) from public, anon;
grant execute on function public.move_room_to_group(uuid, uuid) to authenticated;

create or replace function public.join_room_with_invite(
  p_invite_code text,
  p_character_id uuid,
  p_client_message_id uuid,
  p_room_group_id uuid
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

  if p_room_group_id is not null and not exists (
    select 1 from public.room_groups
    where room_groups.id = p_room_group_id
      and room_groups.user_id = caller_id
  ) then
    raise exception 'room group ownership required' using errcode = '42501';
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
    last_char_id,
    room_group_id
  )
  values (
    selected_room.id,
    caller_id,
    (
      select count(*)
      from public.room_members
      where room_members.user_id = caller_id
        and room_members.room_group_id is not distinct from p_room_group_id
    ),
    p_character_id,
    p_room_group_id
  )
  on conflict (room_id, user_id) do update
  set
    last_char_id = excluded.last_char_id,
    room_group_id = excluded.room_group_id;

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

-- Preserve installed clients that do not know about room groups yet.
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
  existing_group_id uuid;
begin
  select room_members.room_group_id into existing_group_id
  from public.room_members
  join public.rooms on rooms.id = room_members.room_id
  where rooms.invite_code = trim(p_invite_code)
    and room_members.user_id = auth.uid();

  return query
  select * from public.join_room_with_invite(
    p_invite_code,
    p_character_id,
    p_client_message_id,
    existing_group_id
  );
end;
$$;

revoke all on function public.join_room_with_invite(text, uuid, uuid) from public, anon;
grant execute on function public.join_room_with_invite(text, uuid, uuid) to authenticated;
revoke all on function public.join_room_with_invite(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.join_room_with_invite(text, uuid, uuid, uuid) to authenticated;

create or replace function public.get_my_room_summaries()
returns table (summary jsonb)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    to_jsonb(rooms)
    || jsonb_build_object(
      'sort_order', room_members.sort_order,
      'is_favorite', coalesce(room_members.is_favorite, false),
      'room_group_id', room_members.room_group_id,
      'room_group', case
        when room_groups.id is null then null
        else jsonb_build_object(
          'id', room_groups.id,
          'name', room_groups.name,
          'sort_order', room_groups.sort_order
        )
      end,
      'lastMsg', case
        when latest_message.id is null then null
        else jsonb_build_object(
          'id', latest_message.id,
          'content', latest_message.content,
          'type', latest_message.type,
          'created_at', latest_message.created_at,
          'sequence_no', latest_message.sequence_no,
          'characters', case
            when latest_character.id is null then null
            else jsonb_build_object('name', latest_character.name)
          end
        )
      end,
      'unreadCount', coalesce(unread_messages.count, 0)
    ) as summary
  from public.room_members
  join public.rooms
    on rooms.id = room_members.room_id
  left join public.room_groups
    on room_groups.id = room_members.room_group_id
   and room_groups.user_id = auth.uid()
  left join public.room_read_cursors
    on room_read_cursors.room_id = room_members.room_id
   and room_read_cursors.user_id = auth.uid()
  left join lateral (
    select messages.*
    from public.messages
    where messages.room_id = room_members.room_id
    order by messages.sequence_no desc
    limit 1
  ) as latest_message on true
  left join public.characters as latest_character
    on latest_character.id = latest_message.character_id
  left join lateral (
    select count(*)::integer as count
    from public.messages
    where messages.room_id = room_members.room_id
      and messages.user_id <> auth.uid()
      and messages.type <> 'chapter'
      and messages.sequence_no > coalesce(room_read_cursors.last_read_sequence, 0)
  ) as unread_messages on true
  where room_members.user_id = auth.uid();
$$;

do $$
begin
  alter publication supabase_realtime add table public.room_groups;
exception when duplicate_object then null;
end $$;

alter table public.room_groups replica identity full;

comment on table public.room_groups is
  'User-private folders for organizing room memberships without changing shared rooms.';
