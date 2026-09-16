-- Message presentation effects are immutable, optional metadata. Existing rows and
-- the five-argument RPC remain compatible while current clients use the new RPC.

alter table public.messages
  add column if not exists effect_key text;

alter table public.messages
  drop constraint if exists messages_effect_key_check;

alter table public.messages
  add constraint messages_effect_key_check
  check (
    effect_key is null
    or effect_key in ('whisper', 'shout', 'tremble', 'impact', 'monologue')
  );

create or replace function public.send_room_message(
  p_room_id uuid,
  p_client_message_id uuid,
  p_character_id uuid,
  p_type text,
  p_content text,
  p_effect_key text
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

  if p_effect_key is not null and p_effect_key not in (
    'whisper',
    'shout',
    'tremble',
    'impact',
    'monologue'
  ) then
    raise exception 'unsupported message effect' using errcode = '22023';
  end if;

  if p_effect_key is not null and p_type not in ('chat', 'narration') then
    raise exception 'message effects require chat or narration' using errcode = '22023';
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
    client_message_id,
    effect_key
  )
  values (
    p_room_id,
    caller_id,
    p_character_id,
    p_type,
    p_content,
    p_client_message_id,
    p_effect_key
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

-- Preserve old installed/PWA clients. New clients always call the six-argument RPC.
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
begin
  return public.send_room_message(
    p_room_id,
    p_client_message_id,
    p_character_id,
    p_type,
    p_content,
    null
  );
end;
$$;

revoke all on function public.send_room_message(uuid, uuid, uuid, text, text, text) from public, anon;
grant execute on function public.send_room_message(uuid, uuid, uuid, text, text, text) to authenticated;

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
    or new.sequence_no is distinct from old.sequence_no
    or new.effect_key is distinct from old.effect_key then
    raise exception 'message identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on column public.messages.effect_key is
  'Optional immutable presentation effect selected when a chat or narration message is sent.';
