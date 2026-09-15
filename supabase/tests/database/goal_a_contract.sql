begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_column('public', 'messages', 'client_message_id', 'messages has an idempotency key');
select has_column('public', 'messages', 'sequence_no', 'messages has a stable server sequence');
select has_table('public', 'room_read_cursors', 'read cursor table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.room_read_cursors'::regclass), 'read cursors use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'messages use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.rooms'::regclass), 'rooms use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.room_members'::regclass), 'room members use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.characters'::regclass), 'characters use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), 'push subscriptions use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.bookmarks'::regclass), 'legacy bookmarks use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.groups'::regclass), 'groups use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.character_groups'::regclass), 'character groups use RLS');

select ok(
  not has_table_privilege('authenticated', 'public.room_read_cursors', 'INSERT'),
  'authenticated users cannot write read cursors directly'
);
select ok(
  has_table_privilege('authenticated', 'public.room_read_cursors', 'SELECT'),
  'authenticated users can read authorized cursor rows'
);
select ok(
  has_function_privilege('authenticated', 'public.send_room_message(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'authenticated users can call the guarded send RPC'
);
select ok(
  not has_function_privilege('anon', 'public.send_room_message(uuid,uuid,uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot call the send RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.advance_room_read_cursor(uuid,uuid)', 'EXECUTE'),
  'authenticated users can call the guarded read RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.get_my_room_summaries()', 'EXECUTE'),
  'authenticated users can load their room summaries'
);
select ok(
  has_function_privilege('authenticated', 'public.find_room_by_invite_code(text)', 'EXECUTE'),
  'authenticated users can resolve an invite code'
);
select ok(
  has_function_privilege('authenticated', 'public.join_room_with_invite(text,uuid,uuid)', 'EXECUTE'),
  'authenticated users can call the guarded join RPC'
);
select ok(
  not has_function_privilege('anon', 'public.join_room_with_invite(text,uuid,uuid)', 'EXECUTE'),
  'anonymous users cannot call the join RPC'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = '누구나 업로드 가능'
  ),
  'public upload policy has been removed'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload IDEA files'
      and cmd = 'INSERT'
  ),
  'scoped authenticated upload policy exists'
);
select is(
  public.can_manage_idea_upload('forbidden/object.txt'),
  false,
  'unsupported storage prefixes are denied'
);
select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.send_room_message(uuid,uuid,uuid,text,text)'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=pg_catalog, public']
  ),
  'send RPC is a security definer with a fixed search path'
);
select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.is_room_member(uuid)'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=pg_catalog, public']
  ),
  'room membership helper has a fixed search path'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.messages'::regclass
      and tgname = 'protect_message_identity'
      and not tgisinternal
  ),
  'message identity is protected from direct updates'
);

select * from finish();
rollback;
