import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

assert.equal(
  process.env.TEST_ALLOW_FIXTURE_WRITE,
  '1',
  'set TEST_ALLOW_FIXTURE_WRITE=1 only after production fixture creation is approved'
)

const url = required('TEST_SUPABASE_URL')
const serviceRoleKey = required('TEST_SUPABASE_SERVICE_ROLE_KEY')
const runId = required('TEST_GOAL_A_RUN_ID')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceRoleKey, options)
const roomName = `[TEST] Goal A RLS ${runId}`

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})
if (listError) throw listError

const fixtureUsers = listed.users.filter(
  user =>
    user.user_metadata?.purpose === 'goal-a-production-realtime-test' &&
    user.user_metadata?.goal_a_run_id === runId
)
const senderUser = fixtureUsers.find(user => user.user_metadata?.goal_a_role === 'sender')
const readerUser = fixtureUsers.find(user => user.user_metadata?.goal_a_role === 'reader')
assert(senderUser && readerUser, 'the requested Goal A fixture users were not found')

const { data: existingRooms, error: lookupError } = await admin
  .from('rooms')
  .select('id')
  .eq('name', roomName)
  .eq('created_by', senderUser.id)
  .limit(2)
if (lookupError) throw lookupError
assert(existingRooms.length <= 1, 'multiple Goal A private fixture rooms already exist')

let privateRoomId = existingRooms[0]?.id
const reused = Boolean(privateRoomId)
if (!privateRoomId) {
  const { data: room, error: roomError } = await admin
    .from('rooms')
    .insert({ name: roomName, chapter: 'RLS 검증', created_by: senderUser.id })
    .select('id')
    .single()
  if (roomError) throw roomError
  privateRoomId = room.id
}

const { data: readerMembership, error: readerMembershipError } = await admin
  .from('room_members')
  .select('id')
  .eq('room_id', privateRoomId)
  .eq('user_id', readerUser.id)
  .maybeSingle()
if (readerMembershipError) throw readerMembershipError
assert.equal(readerMembership, null, 'reader must not belong to the private RLS fixture room')

const { error: senderMembershipError } = await admin.from('room_members').upsert(
  { room_id: privateRoomId, user_id: senderUser.id, sort_order: 0 },
  { onConflict: 'room_id,user_id' }
)
if (senderMembershipError) throw senderMembershipError

console.log(
  JSON.stringify({
    runId,
    privateRoomId,
    reused,
    senderMembership: true,
    readerMembership: false,
    status: 'ready',
  })
)
