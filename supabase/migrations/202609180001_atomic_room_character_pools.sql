-- Replace a user's room character pool atomically. Validation, deletion, and
-- insertion run in one transaction so a failed save never erases the old pool.

create or replace function public.replace_room_character_pool(
  p_room_id uuid,
  p_character_ids uuid[]
)
returns table (
  character_id uuid,
  sort_order integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_id is null then
    raise exception 'room id is required' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_character_ids), 0) = 0 then
    raise exception 'character selection is empty' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_members.room_id = p_room_id
      and room_members.user_id = caller_id
  ) then
    raise exception 'room membership required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(p_character_ids) as selected(id)
    where selected.id is null
  ) then
    raise exception 'character ownership required' using errcode = '42501';
  end if;

  if (
    select count(*)
    from unnest(p_character_ids) as selected(id)
  ) <> (
    select count(distinct selected.id)
    from unnest(p_character_ids) as selected(id)
  ) then
    raise exception 'character selection contains duplicates' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_character_ids) as selected(id)
    left join public.characters
      on characters.id = selected.id
      and characters.user_id = caller_id
      and characters.is_archived = false
    where characters.id is null
  ) then
    raise exception 'character ownership required' using errcode = '42501';
  end if;

  delete from public.room_characters
  where room_characters.room_id = p_room_id
    and room_characters.user_id = caller_id;

  insert into public.room_characters (
    room_id,
    user_id,
    character_id,
    sort_order
  )
  select
    p_room_id,
    caller_id,
    selected.id,
    (selected.position - 1)::integer
  from unnest(p_character_ids) with ordinality as selected(id, position);

  return query
  select
    room_characters.character_id,
    room_characters.sort_order
  from public.room_characters
  where room_characters.room_id = p_room_id
    and room_characters.user_id = caller_id
  order by room_characters.sort_order;
end;
$$;

revoke all on function public.replace_room_character_pool(uuid, uuid[]) from public, anon;
grant execute on function public.replace_room_character_pool(uuid, uuid[]) to authenticated;

comment on function public.replace_room_character_pool(uuid, uuid[]) is
  'Atomically validates and replaces the authenticated user room character pool.';
