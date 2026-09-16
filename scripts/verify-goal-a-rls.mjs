import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const url = required('TEST_SUPABASE_URL')
const anonKey = required('TEST_SUPABASE_ANON_KEY')
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
const runId = process.env.TEST_GOAL_A_RUN_ID
assert.equal(
  Boolean(serviceRoleKey),
  Boolean(runId),
  'TEST_SUPABASE_SERVICE_ROLE_KEY and TEST_GOAL_A_RUN_ID must be provided together'
)
const sender = createClient(url, anonKey, options)
const outsider = createClient(url, anonKey, options)
const admin = serviceRoleKey ? createClient(url, serviceRoleKey, options) : null
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

const temporaryPassword = () => `${randomBytes(32).toString('base64url')}Aa1!`

const updateAndSignIn = async (client, user) => {
  const password = temporaryPassword()
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  })
  if (updateError) throw updateError
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password })
  if (error) throw error
  return data.user
}

const signInTestUsers = async () => {
  if (!admin) {
    return Promise.all([
      signIn(sender, 'TEST_SENDER'),
      signIn(outsider, 'TEST_READER'),
    ])
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const fixtureUsers = data.users.filter(
    user =>
      user.user_metadata?.purpose === 'goal-a-production-realtime-test' &&
      user.user_metadata?.goal_a_run_id === runId
  )
  const senderUser = fixtureUsers.find(user => user.user_metadata?.goal_a_role === 'sender')
  const readerUser = fixtureUsers.find(user => user.user_metadata?.goal_a_role === 'reader')
  assert(senderUser && readerUser, 'the requested Goal A fixture users were not found')
  return Promise.all([
    updateAndSignIn(sender, senderUser),
    updateAndSignIn(outsider, readerUser),
  ])
}

try {
  const [senderUser, outsiderUser] = await signInTestUsers()
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
    fixtureMode: admin ? 'run-id' : 'credentials',
  }, null, 2))
} finally {
  await Promise.allSettled([sender.auth.signOut(), outsider.auth.signOut()])
}
