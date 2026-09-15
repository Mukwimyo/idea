import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const sender = createClient(required('TEST_SUPABASE_URL'), required('TEST_SUPABASE_ANON_KEY'), options)
const outsider = createClient(required('TEST_SUPABASE_URL'), required('TEST_SUPABASE_ANON_KEY'), options)
const sharedRoomId = required('TEST_ROOM_ID')
const privateRoomId = required('TEST_PRIVATE_ROOM_ID')

const signIn = async (client, prefix) => {
  const { data, error } = await client.auth.signInWithPassword({
    email: required(`${prefix}_EMAIL`),
    password: required(`${prefix}_PASSWORD`),
  })
  if (error) throw error
  return data.user
}

try {
  const [senderUser, outsiderUser] = await Promise.all([
    signIn(sender, 'TEST_SENDER'),
    signIn(outsider, 'TEST_READER'),
  ])
  assert.notEqual(senderUser.id, outsiderUser.id, 'test accounts must be different')

  const [{ data: senderMembership }, { data: outsiderShared }, { data: outsiderPrivate }] = await Promise.all([
    sender.from('room_members').select('room_id').eq('room_id', privateRoomId).maybeSingle(),
    outsider.from('room_members').select('room_id').eq('room_id', sharedRoomId).maybeSingle(),
    outsider.from('room_members').select('room_id').eq('room_id', privateRoomId).maybeSingle(),
  ])
  assert(senderMembership, 'sender must belong to TEST_PRIVATE_ROOM_ID')
  assert(outsiderShared, 'reader must belong to TEST_ROOM_ID')
  assert.equal(outsiderPrivate, null, 'reader must not belong to TEST_PRIVATE_ROOM_ID')

  const clientMessageId = randomUUID()
  const { data: privateResult, error: privateSendError } = await sender.rpc('send_room_message', {
    p_room_id: privateRoomId,
    p_client_message_id: clientMessageId,
    p_character_id: process.env.TEST_SENDER_CHARACTER_ID || null,
    p_type: 'chat',
    p_content: `[goal-a-rls:${clientMessageId}] private boundary probe`,
  })
  if (privateSendError) throw privateSendError
  const privateMessage = Array.isArray(privateResult) ? privateResult[0] : privateResult

  const { data: leakedMessages, error: privateReadError } = await outsider
    .from('messages')
    .select('id')
    .eq('room_id', privateRoomId)
  if (privateReadError) throw privateReadError
  assert.deepEqual(leakedMessages, [], 'outsider could read private-room messages')

  const { data: leakedRoom, error: roomReadError } = await outsider
    .from('rooms')
    .select('id')
    .eq('id', privateRoomId)
  if (roomReadError) throw roomReadError
  assert.deepEqual(leakedRoom, [], 'outsider could read private room metadata')

  const { data: leakedProfile, error: profileReadError } = await outsider
    .from('profiles')
    .select('id')
    .eq('id', senderUser.id)
  if (profileReadError) throw profileReadError
  assert.deepEqual(leakedProfile, [], 'outsider could read another profile')

  const { error: forgedSendError } = await outsider.rpc('send_room_message', {
    p_room_id: privateRoomId,
    p_client_message_id: randomUUID(),
    p_character_id: null,
    p_type: 'chat',
    p_content: '[goal-a-rls] this must be rejected',
  })
  assert(forgedSendError, 'outsider could send to a private room')

  const { error: forgedReadError } = await outsider.rpc('advance_room_read_cursor', {
    p_room_id: privateRoomId,
    p_message_id: privateMessage.id,
  })
  assert(forgedReadError, 'outsider could advance a private-room read cursor')

  const { data: adminOracle, error: adminOracleError } = await outsider.rpc('is_idea_admin', {
    check_user_id: senderUser.id,
  })
  if (adminOracleError) throw adminOracleError
  assert.equal(adminOracle, false, 'admin membership oracle exposed another account')

  const { error: adminRpcError } = await outsider.rpc('admin_dashboard_stats')
  assert(adminRpcError, 'non-admin account could call an admin RPC')

  const { data: invalidUploadAllowed, error: uploadGuardError } = await outsider.rpc(
    'can_manage_idea_upload',
    { object_name: `forbidden/${randomUUID()}.txt` }
  )
  if (uploadGuardError) throw uploadGuardError
  assert.equal(invalidUploadAllowed, false, 'unsupported Storage prefix was allowed')

  const { data: summaries, error: summaryError } = await outsider.rpc('get_my_room_summaries')
  if (summaryError) throw summaryError
  const roomIds = (summaries || []).map(row => (row.summary || row).id)
  assert(roomIds.includes(sharedRoomId), 'shared room missing from authorized summaries')
  assert(!roomIds.includes(privateRoomId), 'private room leaked through room summaries')

  console.log(JSON.stringify({
    privateMessageHidden: true,
    privateRoomHidden: true,
    otherProfileHidden: true,
    forgedSendDenied: true,
    forgedReadDenied: true,
    adminRpcDenied: true,
    invalidStoragePrefixDenied: true,
  }, null, 2))
} finally {
  await Promise.allSettled([sender.auth.signOut(), outsider.auth.signOut()])
}
