begin;

do $$
declare
  shared_room_id uuid;
  sender_id uuid;
  reader_id uuid;
  outsider_id uuid;
  client_id uuid := gen_random_uuid();
  first_message public.messages%rowtype;
  retry_message public.messages%rowtype;
  first_cursor public.room_read_cursors%rowtype;
  legacy_cursor public.room_read_cursors%rowtype;
  retry_cursor public.room_read_cursors%rowtype;
  older_message_id uuid;
begin
  select
    room_members.room_id,
    min(room_members.user_id::text)::uuid,
    max(room_members.user_id::text)::uuid
  into shared_room_id, sender_id, reader_id
  from public.room_members
  group by room_members.room_id
  having count(distinct room_members.user_id) >= 2
     and exists (
       select 1
       from public.messages
       where messages.room_id = room_members.room_id
     )
  order by count(distinct room_members.user_id) desc, room_members.room_id
  limit 1;

  if shared_room_id is null or sender_id = reader_id then
    raise exception 'Goal A smoke test requires a populated room with two members';
  end if;

  perform set_config('request.jwt.claim.sub', sender_id::text, true);

  select * into first_message
  from public.send_room_message(
    shared_room_id,
    client_id,
    null,
    'chat',
    '[goal-a-transactional-smoke] idempotent delivery probe'
  );

  select * into retry_message
  from public.send_room_message(
    shared_room_id,
    client_id,
    null,
    'chat',
    '[goal-a-transactional-smoke] idempotent delivery probe'
  );

  if first_message.id is null or retry_message.id <> first_message.id then
    raise exception 'idempotent retry produced a different server message';
  end if;

  if (
    select count(*)
    from public.messages
    where messages.user_id = sender_id
      and messages.client_message_id = client_id
  ) <> 1 then
    raise exception 'idempotency key did not resolve to exactly one row';
  end if;

  perform set_config('request.jwt.claim.sub', reader_id::text, true);

  update public.messages
  set read_by = array[reader_id::text]
  where messages.id = first_message.id;

  select * into legacy_cursor
  from public.room_read_cursors
  where room_read_cursors.room_id = shared_room_id
    and room_read_cursors.user_id = reader_id;

  if legacy_cursor.last_read_sequence <> first_message.sequence_no then
    raise exception 'legacy read_by bridge did not advance the read cursor';
  end if;

  select * into first_cursor
  from public.advance_room_read_cursor(shared_room_id, first_message.id);

  select messages.id into older_message_id
  from public.messages
  where messages.room_id = shared_room_id
    and messages.sequence_no < first_message.sequence_no
  order by messages.sequence_no desc
  limit 1;

  if older_message_id is null then
    raise exception 'Goal A smoke test requires an older message';
  end if;

  select * into retry_cursor
  from public.advance_room_read_cursor(shared_room_id, older_message_id);

  if first_cursor.last_read_sequence <> first_message.sequence_no
     or retry_cursor.last_read_sequence <> first_message.sequence_no then
    raise exception 'read cursor moved backward or failed to advance';
  end if;

  if not exists (
    select 1
    from public.get_my_room_summaries() as summaries
    where (summaries.summary ->> 'id')::uuid = shared_room_id
  ) then
    raise exception 'authorized room is missing from room summaries';
  end if;

  select room_members.user_id into outsider_id
  from public.room_members
  where not exists (
    select 1
    from public.room_members as shared_members
    where shared_members.room_id = shared_room_id
      and shared_members.user_id = room_members.user_id
  )
  order by room_members.user_id
  limit 1;

  if outsider_id is not null then
    perform set_config('request.jwt.claim.sub', outsider_id::text, true);

    begin
      perform public.send_room_message(
        shared_room_id,
        gen_random_uuid(),
        null,
        'chat',
        '[goal-a-transactional-smoke] unauthorized probe'
      );
      raise exception 'non-member message send unexpectedly succeeded';
    exception
      when insufficient_privilege then null;
    end;

    begin
      perform public.advance_room_read_cursor(shared_room_id, first_message.id);
      raise exception 'non-member read cursor update unexpectedly succeeded';
    exception
      when insufficient_privilege then null;
    end;
  end if;
end;
$$;

rollback;
