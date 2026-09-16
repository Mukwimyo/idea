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

revoke all on function public.get_my_room_summaries() from public, anon;
grant execute on function public.get_my_room_summaries() to authenticated;

comment on function public.get_my_room_summaries() is
  'Returns authorized room cards, latest messages, and cursor-based unread counts in one query.';

create or replace function public.sync_legacy_message_read_cursors()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.read_by is not distinct from old.read_by then
    return new;
  end if;

  insert into public.room_read_cursors (
    room_id,
    user_id,
    last_read_sequence,
    last_read_message_id,
    updated_at
  )
  select distinct
    new.room_id,
    room_members.user_id,
    new.sequence_no,
    new.id,
    now()
  from unnest(coalesce(new.read_by, '{}'::text[])) as readers(user_id)
  join public.room_members
    on room_members.room_id = new.room_id
   and room_members.user_id::text = readers.user_id
   and room_members.user_id = auth.uid()
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
    end;

  return new;
end;
$$;

revoke all on function public.sync_legacy_message_read_cursors() from public, anon, authenticated;

drop trigger if exists sync_legacy_message_read_cursors on public.messages;
create trigger sync_legacy_message_read_cursors
after insert or update of read_by on public.messages
for each row
execute function public.sync_legacy_message_read_cursors();

do $$
begin
  alter publication supabase_realtime add table public.room_read_cursors;
exception when duplicate_object then null;
end $$;

alter table public.room_read_cursors replica identity full;

comment on function public.sync_legacy_message_read_cursors() is
  'Bridges the authenticated reader''s monotonic position from the currently deployed read_by client during rollout.';
