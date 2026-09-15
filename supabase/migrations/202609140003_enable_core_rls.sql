-- Enable and repair RLS on legacy core tables that currently have policies but
-- are not protected by RLS. Keep this migration in the same release as the
-- cursor-based client because legacy read_by writes are intentionally retired.

create or replace function public.is_room_member(check_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members
    where room_members.room_id = check_room_id
      and room_members.user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

create or replace function public.is_idea_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    check_user_id = auth.uid()
    and exists (
      select 1
      from public.idea_admin_users
      where idea_admin_users.user_id = auth.uid()
    );
$$;

revoke all on function public.is_idea_admin(uuid) from public, anon;
grant execute on function public.is_idea_admin(uuid) to authenticated;

alter function public.set_room_current_location(uuid, uuid)
  set search_path = pg_catalog, public;
alter function public.play_room_playlist_item(uuid, uuid, boolean)
  set search_path = pg_catalog, public;
alter function public.advance_room_playlist(uuid, uuid, integer)
  set search_path = pg_catalog, public;

alter table public.bookmarks enable row level security;
alter table public.character_groups enable row level security;
alter table public.characters enable row level security;
alter table public.groups enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.room_members enable row level security;
alter table public.rooms enable row level security;

drop policy if exists bookmarks_delete on public.bookmarks;
drop policy if exists bookmarks_insert on public.bookmarks;
drop policy if exists bookmarks_select on public.bookmarks;
drop policy if exists "북마크 관리" on public.bookmarks;
create policy "Users manage own legacy bookmarks"
on public.bookmarks for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists characters_delete on public.characters;
drop policy if exists characters_insert on public.characters;
drop policy if exists characters_select on public.characters;
drop policy if exists characters_update on public.characters;
drop policy if exists "본인 캐릭터만" on public.characters;
drop policy if exists "Room members can view shared room characters" on public.characters;
create policy "Users can view available characters"
on public.characters for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.room_characters
    where room_characters.character_id = characters.id
      and public.is_room_member(room_characters.room_id)
  )
);
create policy "Users can create own characters"
on public.characters for insert to authenticated
with check (user_id = auth.uid());
create policy "Users can update own characters"
on public.characters for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy "Users can delete own characters"
on public.characters for delete to authenticated
using (user_id = auth.uid());

create policy "Users manage own groups"
on public.groups for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (room_id is null or public.is_room_member(room_id))
);

create policy "Users view own character group links"
on public.character_groups for select to authenticated
using (
  exists (
    select 1 from public.characters
    where characters.id = character_groups.character_id
      and characters.user_id = auth.uid()
  )
  and exists (
    select 1 from public.groups
    where groups.id = character_groups.group_id
      and groups.user_id = auth.uid()
  )
);
create policy "Users create own character group links"
on public.character_groups for insert to authenticated
with check (
  exists (
    select 1 from public.characters
    where characters.id = character_groups.character_id
      and characters.user_id = auth.uid()
  )
  and exists (
    select 1 from public.groups
    where groups.id = character_groups.group_id
      and groups.user_id = auth.uid()
  )
);
create policy "Users delete own character group links"
on public.character_groups for delete to authenticated
using (
  exists (
    select 1 from public.characters
    where characters.id = character_groups.character_id
      and characters.user_id = auth.uid()
  )
  and exists (
    select 1 from public.groups
    where groups.id = character_groups.group_id
      and groups.user_id = auth.uid()
  )
);

drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists "본인 프로필만" on public.profiles;
create policy "Users manage own profile"
on public.profiles for all to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users manage own push subscriptions"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists room_members_delete on public.room_members;
drop policy if exists room_members_insert on public.room_members;
drop policy if exists room_members_select on public.room_members;
drop policy if exists "멤버 조회" on public.room_members;
drop policy if exists "멤버 추가" on public.room_members;
create policy "Room members can view fellow members"
on public.room_members for select to authenticated
using (user_id = auth.uid() or public.is_room_member(room_id));
create policy "Room owners can initialize their membership"
on public.room_members for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.rooms
    where rooms.id = room_members.room_id
      and rooms.created_by = auth.uid()
  )
);
create policy "Users can update own room membership"
on public.room_members for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy "Users can leave rooms"
on public.room_members for delete to authenticated
using (user_id = auth.uid());

create or replace function public.protect_room_member_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.room_id is distinct from old.room_id or new.user_id is distinct from old.user_id then
    raise exception 'room membership identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_room_member_identity on public.room_members;
create trigger protect_room_member_identity
before update on public.room_members
for each row execute function public.protect_room_member_identity();

drop policy if exists rooms_delete on public.rooms;
drop policy if exists rooms_insert on public.rooms;
drop policy if exists rooms_select on public.rooms;
drop policy if exists rooms_update on public.rooms;
drop policy if exists "방 멤버만 조회" on public.rooms;
drop policy if exists "방 생성" on public.rooms;
create policy "Room members can view rooms"
on public.rooms for select to authenticated
using (created_by = auth.uid() or public.is_room_member(id));
create policy "Users can create rooms"
on public.rooms for insert to authenticated
with check (created_by = auth.uid());
create policy "Room members can update rooms"
on public.rooms for update to authenticated
using (public.is_room_member(id))
with check (public.is_room_member(id));
create policy "Room owners can delete rooms"
on public.rooms for delete to authenticated
using (created_by = auth.uid());

create or replace function public.protect_room_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.invite_code is distinct from old.invite_code then
    raise exception 'room identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_room_identity on public.rooms;
create trigger protect_room_identity
before update on public.rooms
for each row execute function public.protect_room_identity();

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

drop policy if exists messages_delete on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_update on public.messages;
drop policy if exists "메시지 수정" on public.messages;
drop policy if exists "메시지 작성" on public.messages;
drop policy if exists "메시지 조회" on public.messages;
create policy "Room members can view messages"
on public.messages for select to authenticated
using (public.is_room_member(room_id));
create policy "Room members can create own messages"
on public.messages for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_room_member(room_id)
  and (
    character_id is null
    or exists (
      select 1 from public.characters
      where characters.id = messages.character_id
        and characters.user_id = auth.uid()
    )
  )
);
create policy "Room members can update message state"
on public.messages for update to authenticated
using (public.is_room_member(room_id))
with check (public.is_room_member(room_id));
create policy "Authors and room owners can delete messages"
on public.messages for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.rooms
    where rooms.id = messages.room_id
      and rooms.created_by = auth.uid()
  )
);

create or replace function public.protect_message_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id
    or new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.character_id is distinct from old.character_id
    or new.type is distinct from old.type
    or new.client_message_id is distinct from old.client_message_id
    or new.sequence_no is distinct from old.sequence_no then
    raise exception 'message identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_message_identity on public.messages;
create trigger protect_message_identity
before update on public.messages
for each row execute function public.protect_message_identity();

create or replace function public.can_manage_idea_upload(object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, storage
as $$
  select case (storage.foldername(object_name))[1]
    when 'avatars' then (storage.foldername(object_name))[2] = auth.uid()::text
    when 'talking-frames' then (storage.foldername(object_name))[2] = auth.uid()::text
    when 'chat' then exists (
      select 1 from public.room_members
      where room_members.room_id::text = (storage.foldername(object_name))[2]
        and room_members.user_id = auth.uid()
    )
    when 'rooms' then exists (
      select 1 from public.room_members
      where room_members.room_id::text = (storage.foldername(object_name))[2]
        and room_members.user_id = auth.uid()
    )
    when 'bgm' then public.is_idea_admin()
    else false
  end;
$$;

revoke all on function public.can_manage_idea_upload(text) from public, anon;
grant execute on function public.can_manage_idea_upload(text) to authenticated;

drop policy if exists "누구나 업로드 가능" on storage.objects;
drop policy if exists "본인 파일 삭제" on storage.objects;
drop policy if exists "Authenticated users can upload IDEA files" on storage.objects;
create policy "Authenticated users can upload IDEA files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'idea-uploads'
  and public.can_manage_idea_upload(name)
);

drop policy if exists "Authenticated users can update IDEA files" on storage.objects;
create policy "Authenticated users can update IDEA files"
on storage.objects for update to authenticated
using (
  bucket_id = 'idea-uploads'
  and public.can_manage_idea_upload(name)
)
with check (
  bucket_id = 'idea-uploads'
  and public.can_manage_idea_upload(name)
);

drop policy if exists "Authenticated users can delete IDEA files" on storage.objects;
create policy "Authenticated users can delete IDEA files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'idea-uploads'
  and public.can_manage_idea_upload(name)
);

comment on function public.can_manage_idea_upload(text) is
  'Restricts writes in the legacy public bucket by account or room membership. Public reads remain for URL compatibility.';
