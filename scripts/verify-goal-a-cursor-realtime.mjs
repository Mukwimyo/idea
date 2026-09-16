import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const url = required('TEST_SUPABASE_URL')
const anonKey = required('TEST_SUPABASE_ANON_KEY')
const serviceRoleKey = required('TEST_SUPABASE_SERVICE_ROLE_KEY')
const runId = required('TEST_GOAL_A_RUN_ID')
const roomId = required('TEST_ROOM_ID')
const subscriberMode = process.env.TEST_CURSOR_SUBSCRIBER || 'authenticated'
const mutationMode = process.env.TEST_CURSOR_MUTATION || 'update'
assert(
  subscriberMode === 'authenticated' || subscriberMode === 'service',
  'TEST_CURSOR_SUBSCRIBER must be authenticated or service'
)
assert(
  mutationMode === 'insert' || mutationMode === 'update',
  'TEST_CURSOR_MUTATION must be insert or update'
)
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceRoleKey, options)
const sender = createClient(url, anonKey, options)
const reader = createClient(url, anonKey, options)
const subscriber = subscriberMode === 'service' ? admin : sender

const password = () => `${randomBytes(32).toString('base64url')}Aa1!`
const senderPassword = password()
const readerPassword = password()
let channel
let eventTimeout
let cursorRestore
let failure

const updateAndSignIn = async (client, user, passwordValue) => {
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: passwordValue,
    email_confirm: true,
  })
  if (updateError) throw updateError
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: passwordValue,
  })
  if (error) throw error
  return data.user
}

try {
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

  await Promise.all([
    updateAndSignIn(sender, senderUser, senderPassword),
    updateAndSignIn(reader, readerUser, readerPassword),
  ])

  const { data: messages, error: messageError } = await reader
    .from('messages')
    .select('id, sequence_no')
    .eq('room_id', roomId)
    .like('content', `[goal-a-realtime:${runId}:%`)
    .order('sequence_no', { ascending: true })
  if (messageError) throw messageError
  assert.equal(messages.length, 100, 'fixture room does not contain exactly 100 test messages')
  const oldest = messages[0]
  const latest = messages.at(-1)
  cursorRestore = {
    room_id: roomId,
    user_id: readerUser.id,
    last_read_sequence: latest.sequence_no,
    last_read_message_id: latest.id,
    updated_at: new Date().toISOString(),
  }

  if (mutationMode === 'insert') {
    const { error: deleteError } = await admin
      .from('room_read_cursors')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', readerUser.id)
    if (deleteError) throw deleteError
  } else {
    const { error: rewindError } = await admin
      .from('room_read_cursors')
      .update({
        last_read_sequence: oldest.sequence_no,
        last_read_message_id: oldest.id,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('user_id', readerUser.id)
    if (rewindError) throw rewindError
  }

  let resolveCursorEvent
  let rejectCursorEvent
  const cursorEvent = new Promise((resolve, reject) => {
    resolveCursorEvent = resolve
    rejectCursorEvent = reject
  })
  await new Promise((resolve, reject) => {
    const subscribeTimeout = setTimeout(
      () => reject(new Error('read cursor subscription timed out')),
      15_000
    )
    channel = subscriber
      .channel(`goal-a-cursor-${runId}-${randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_read_cursors',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          if (
            payload.new.user_id === readerUser.id &&
            Number(payload.new.last_read_sequence) === Number(latest.sequence_no) &&
            payload.eventType.toLowerCase() === mutationMode
          ) {
            resolveCursorEvent(payload.new)
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(subscribeTimeout)
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(subscribeTimeout)
          reject(new Error(`read cursor subscription failed: ${status}`))
        }
      })
  })

  eventTimeout = setTimeout(
    () => rejectCursorEvent(new Error('read cursor Realtime event timed out')),
    30_000
  )

  const { data: cursorResult, error: cursorError } = await reader.rpc(
    'advance_room_read_cursor',
    { p_room_id: roomId, p_message_id: latest.id }
  )
  if (cursorError) throw cursorError
  const cursor = Array.isArray(cursorResult) ? cursorResult[0] : cursorResult
  assert.equal(Number(cursor.last_read_sequence), Number(latest.sequence_no))

  const event = await cursorEvent
  clearTimeout(eventTimeout)
  assert.equal(Number(event.last_read_sequence), Number(latest.sequence_no))

  console.log(
    JSON.stringify({
      runId,
      roomId,
      subscriberMode,
      mutationMode,
      publishedCursorUpdate: true,
      cursorSequence: Number(event.last_read_sequence),
      status: 'passed',
    })
  )
} catch (error) {
  failure = error
} finally {
  if (eventTimeout) clearTimeout(eventTimeout)
  if (channel) await subscriber.removeChannel(channel)
  if (cursorRestore) {
    const { error: restoreError } = await admin
      .from('room_read_cursors')
      .upsert(cursorRestore, { onConflict: 'room_id,user_id' })
    if (restoreError && !failure) failure = restoreError
  }
  await Promise.allSettled([
    admin.removeAllChannels(),
    sender.removeAllChannels(),
    reader.removeAllChannels(),
  ])
  admin.realtime.disconnect()
  sender.realtime.disconnect()
  reader.realtime.disconnect()
  await Promise.allSettled([sender.auth.signOut(), reader.auth.signOut()])
}

if (failure) throw failure
