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
const count = Number(process.env.TEST_MESSAGE_COUNT || 100)
assert.equal(count, 100, 'production Realtime verification requires exactly 100 messages')

const runId =
  process.env.TEST_GOAL_A_RUN_ID ||
  `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`
const senderEmail = `goal-a-sender-${runId}@example.invalid`
const readerEmail = `goal-a-reader-${runId}@example.invalid`
const password = () => `${randomBytes(32).toString('base64url')}Aa1!`
const senderPassword = password()
const readerPassword = password()
const options = { auth: { persistSession: false, autoRefreshToken: false } }

const admin = createClient(url, serviceRoleKey, options)
const sender = createClient(url, anonKey, options)
const reader = createClient(url, anonKey, options)

let senderUser
let readerUser
let roomId
let channel

const createTestUser = async (email, role) => {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find(
    user =>
      user.email === email &&
      user.user_metadata?.purpose === 'goal-a-production-realtime-test' &&
      user.user_metadata?.goal_a_run_id === runId
  )
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: role === 'sender' ? senderPassword : readerPassword,
      email_confirm: true,
      user_metadata: {
        purpose: 'goal-a-production-realtime-test',
        goal_a_run_id: runId,
        goal_a_role: role,
      },
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: role === 'sender' ? senderPassword : readerPassword,
    email_confirm: true,
    user_metadata: {
      purpose: 'goal-a-production-realtime-test',
      goal_a_run_id: runId,
      goal_a_role: role,
    },
  })
  if (error) throw error
  return data.user
}

const signIn = async (client, email, passwordValue) => {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: passwordValue,
  })
  if (error) throw error
  return data.user
}

const subscribe = async (phase, receivedIds) => {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Realtime subscription timed out during ${phase}`)),
      15_000
    )
    channel = reader
      .channel(`goal-a-${runId}-${phase}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          if (payload.new.client_message_id) receivedIds.add(payload.new.client_message_id)
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout)
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout)
          reject(new Error(`Realtime subscription failed during ${phase}: ${status}`))
        }
      })
  })
}

const send = async (clientMessageId, index) => {
  const payload = {
    p_room_id: roomId,
    p_client_message_id: clientMessageId,
    p_character_id: null,
    p_type: 'chat',
    p_content: `[goal-a-realtime:${runId}:${clientMessageId}] ${index + 1}/${count}`,
  }
  const { data, error } = await sender.rpc('send_room_message', payload)
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

const sendRange = async (clientIds, start, end, phase) => {
  for (let index = start; index < end; index += 1) {
    const [first, duplicate] = await Promise.all([
      send(clientIds[index], index),
      send(clientIds[index], index),
    ])
    assert.equal(first.id, duplicate.id, `retry ${index + 1} created a duplicate`)
    if ((index + 1) % 10 === 0) {
      console.log(`${phase}: ${index + 1}/${count}`)
    }
  }
}

const loadStoredMessages = async clientIds => {
  const stored = []
  for (let start = 0; start < clientIds.length; start += 40) {
    const chunk = clientIds.slice(start, start + 40)
    const { data, error } = await reader
      .from('messages')
      .select('id, client_message_id, sequence_no')
      .eq('room_id', roomId)
      .in('client_message_id', chunk)
    if (error) throw error
    stored.push(...data)
  }
  return stored
}

try {
  console.log(JSON.stringify({ runId, phase: 'provisioning' }))
  ;[senderUser, readerUser] = await Promise.all([
    createTestUser(senderEmail, 'sender'),
    createTestUser(readerEmail, 'reader'),
  ])

  const { error: profileError } = await admin.from('profiles').upsert(
    [
      { id: senderUser.id, email: senderEmail },
      { id: readerUser.id, email: readerEmail },
    ],
    { onConflict: 'id' }
  )
  if (profileError) throw profileError

  const { data: room, error: roomError } = await admin
    .from('rooms')
    .insert({
      name: `[TEST] Goal A Realtime ${runId}`,
      chapter: '검증',
      created_by: senderUser.id,
    })
    .select('id')
    .single()
  if (roomError) throw roomError
  roomId = room.id

  const { error: membershipError } = await admin.from('room_members').insert([
    { room_id: roomId, user_id: senderUser.id, sort_order: 0 },
    { room_id: roomId, user_id: readerUser.id, sort_order: 0 },
  ])
  if (membershipError) throw membershipError

  const [signedInSender, signedInReader] = await Promise.all([
    signIn(sender, senderEmail, senderPassword),
    signIn(reader, readerEmail, readerPassword),
  ])
  assert.equal(signedInSender.id, senderUser.id)
  assert.equal(signedInReader.id, readerUser.id)

  const receivedBeforeDisconnect = new Set()
  const receivedAfterReconnect = new Set()
  const clientIds = Array.from({ length: count }, () => randomUUID())

  await subscribe('before-disconnect', receivedBeforeDisconnect)
  await sendRange(clientIds, 0, 40, 'connected')
  await new Promise(resolve => setTimeout(resolve, 500))
  await reader.removeChannel(channel)
  channel = null

  await sendRange(clientIds, 40, 60, 'disconnected')

  await subscribe('after-reconnect', receivedAfterReconnect)
  await sendRange(clientIds, 60, 100, 'reconnected')
  await new Promise(resolve => setTimeout(resolve, 1_000))

  assert(receivedBeforeDisconnect.size > 0, 'no Realtime events arrived before disconnect')
  assert(receivedAfterReconnect.size > 0, 'no Realtime events arrived after reconnect')

  const offlineIds = new Set(clientIds.slice(40, 60))
  const replayedOfflineEvents = [...receivedAfterReconnect].filter(id => offlineIds.has(id))
  assert.equal(replayedOfflineEvents.length, 0, 'Realtime unexpectedly replayed disconnected events')

  const stored = await loadStoredMessages(clientIds)
  assert.equal(stored.length, count, 'reconciliation did not recover all 100 rows')
  assert.equal(new Set(stored.map(message => message.id)).size, count, 'duplicate server ids found')
  assert.equal(
    new Set(stored.map(message => Number(message.sequence_no))).size,
    count,
    'duplicate server sequences found'
  )

  const ordered = [...stored].sort(
    (left, right) => Number(left.sequence_no) - Number(right.sequence_no)
  )
  const oldest = ordered[0]
  const latest = ordered.at(-1)

  const { data: firstCursorResult, error: firstCursorError } = await reader.rpc(
    'advance_room_read_cursor',
    { p_room_id: roomId, p_message_id: latest.id }
  )
  if (firstCursorError) throw firstCursorError
  const firstCursor = Array.isArray(firstCursorResult) ? firstCursorResult[0] : firstCursorResult

  const { data: retryCursorResult, error: retryCursorError } = await reader.rpc(
    'advance_room_read_cursor',
    { p_room_id: roomId, p_message_id: oldest.id }
  )
  if (retryCursorError) throw retryCursorError
  const retryCursor = Array.isArray(retryCursorResult) ? retryCursorResult[0] : retryCursorResult

  assert.equal(Number(firstCursor.last_read_sequence), Number(latest.sequence_no))
  assert.equal(
    Number(retryCursor.last_read_sequence),
    Number(latest.sequence_no),
    'reader cursor moved backward'
  )

  const { data: visibleCursor, error: visibleCursorError } = await sender
    .from('room_read_cursors')
    .select('last_read_sequence')
    .eq('room_id', roomId)
    .eq('user_id', readerUser.id)
    .single()
  if (visibleCursorError) throw visibleCursorError
  assert.equal(Number(visibleCursor.last_read_sequence), Number(latest.sequence_no))

  const realtimeReceived = new Set([
    ...receivedBeforeDisconnect,
    ...receivedAfterReconnect,
  ])

  console.log(
    JSON.stringify(
      {
        runId,
        roomId,
        provisionedAccounts: 2,
        sentClientIds: count,
        storedRows: stored.length,
        duplicateRows: 0,
        realtimeBeforeDisconnect: receivedBeforeDisconnect.size,
        realtimeAfterReconnect: receivedAfterReconnect.size,
        recoveredWhileDisconnected: offlineIds.size,
        reconciledMissingEvents: count - realtimeReceived.size,
        finalCursorSequence: Number(visibleCursor.last_read_sequence),
        status: 'passed',
      },
      null,
      2
    )
  )
} catch (error) {
  console.error(
    JSON.stringify({
      runId,
      roomId,
      fixtureMayRemain: Boolean(senderUser || readerUser || roomId),
      status: 'failed',
      error:
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : JSON.stringify(error),
    })
  )
  throw error
} finally {
  if (channel) await reader.removeChannel(channel)
  await Promise.allSettled([sender.auth.signOut(), reader.auth.signOut()])
}
