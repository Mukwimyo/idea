-- Character-specific text presentation settings. A snapshot is copied to each
-- chat/narration message so later character edits never rewrite message history.

create or replace function public.default_text_effect_settings()
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select '{"entryMode":"jamo","entryMotion":"stationary","modifiers":[],"intensity":49,"irregularity":64,"letterSpacing":0,"speed":4,"autoAccelerate":true,"animate":true}'::jsonb;
$$;

create or replace function public.is_valid_text_effect_settings(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select value is not null
    and jsonb_typeof(value) = 'object'
    and value->>'entryMode' in ('instant', 'jamo', 'syllable', 'decode', 'hesitate', 'correct')
    and value->>'entryMotion' in ('stationary', 'rise')
    and jsonb_typeof(value->'modifiers') = 'array'
    and not exists (
      select 1 from jsonb_array_elements_text(value->'modifiers') modifier
      where modifier not in ('twist', 'runaway', 'disconnect')
    )
    and (value->>'intensity')::numeric between 0 and 100
    and (value->>'irregularity')::numeric between 0 and 100
    and (value->>'letterSpacing')::numeric between -2 and 6
    and (value->>'speed')::numeric between 0.5 and 5
    and jsonb_typeof(value->'autoAccelerate') = 'boolean'
    and jsonb_typeof(value->'animate') = 'boolean';
$$;

alter table public.characters
  add column if not exists text_effect_settings jsonb
  default public.default_text_effect_settings();

update public.characters
set text_effect_settings = public.default_text_effect_settings()
where text_effect_settings is null;

alter table public.characters
  alter column text_effect_settings set not null;

alter table public.characters
  drop constraint if exists characters_text_effect_settings_check;

alter table public.characters
  add constraint characters_text_effect_settings_check
  check (public.is_valid_text_effect_settings(text_effect_settings));

alter table public.messages
  add column if not exists text_effect_settings jsonb;

alter table public.messages
  drop constraint if exists messages_text_effect_settings_check;

alter table public.messages
  add constraint messages_text_effect_settings_check
  check (text_effect_settings is null or public.is_valid_text_effect_settings(text_effect_settings));

create or replace function public.snapshot_message_text_effect_settings()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  character_settings jsonb;
begin
  if new.type not in ('chat', 'narration') then
    new.text_effect_settings := null;
    return new;
  end if;

  if new.character_id is not null then
    select characters.text_effect_settings
      into character_settings
      from public.characters
      where characters.id = new.character_id
        and characters.user_id = new.user_id;
  end if;

  new.text_effect_settings := coalesce(character_settings, public.default_text_effect_settings());
  return new;
end;
$$;

drop trigger if exists snapshot_message_text_effect_settings on public.messages;
create trigger snapshot_message_text_effect_settings
before insert on public.messages
for each row execute function public.snapshot_message_text_effect_settings();

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
    or new.effect_key is distinct from old.effect_key
    or new.text_effect_settings is distinct from old.text_effect_settings then
    raise exception 'message identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on column public.characters.text_effect_settings is
  'Owner-editable text presentation defaults used for newly sent character messages.';

comment on column public.messages.text_effect_settings is
  'Immutable text presentation snapshot captured when a chat or narration message is inserted.';
