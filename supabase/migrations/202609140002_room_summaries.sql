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
