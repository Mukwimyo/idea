import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const required = name => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const url = required('TEST_SUPABASE_URL')
const anonKey = required('TEST_SUPABASE_ANON_KEY')
const roomId = required('TEST_ROOM_ID')
const count = Number(process.env.TEST_MESSAGE_COUNT || 100)
assert(Number.isInteger(count) && count > 0 && count <= 500, 'TEST_MESSAGE_COUNT must be 1..500')

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }
const sender = createClient(url, anonKey, clientOptions)
const reader = createClient(url, anonKey, clientOptions)

const signIn = async (client, prefix) => {
  const { data, error } = await client.auth.signInWithPassword({
    email: required(`${prefix}_EMAIL`),
    password: required(`${prefix}_PASSWORD`),
  })
  if (error) throw error
  return data.user
}

const send = async (clientMessageId, index) => {
  const payload = {
    p_room_id: roomId,
    p_client_message_id: clientMessageId,
    p_character_id: process.env.TEST_SENDER_CHARACTER_ID || null,
    p_type: 'chat',
    p_content: `[goal-a:${clientMessageId}] ${index + 1}/${count}`,
  }
  const { data, error } = await sender.rpc('send_room_message', payload)
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

let senderUser
let readerUser
const receivedIds = new Set()
let channel

try {
  ;[senderUser, readerUser] = await Promise.all([
    signIn(sender, 'TEST_SENDER'),
    signIn(reader, 'TEST_READER'),
  ])
  assert.notEqual(senderUser.id, readerUser.id, 'test accounts must be different')

  const membershipChecks = await Promise.all(
    [sender, reader].map(client =>
      client.from('room_members').select('room_id').eq('room_id', roomId).maybeSingle()
    )
  )
  for (const check of membershipChecks) {
    if (check.error) throw check.error
    assert(check.data, 'both accounts must already belong to TEST_ROOM_ID')
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscription timed out')), 15_000)
    channel = reader
      .channel(`goal-a-${randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, payload => {
        if (payload.new.client_message_id) receivedIds.add(payload.new.client_message_id)
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout)
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout)
          reject(new Error(`Realtime subscription failed: ${status}`))
        }
      })
  })

  const clientIds = Array.from({ length: count }, () => randomUUID())
  const persisted = []
  for (let index = 0; index < clientIds.length; index += 1) {
    const [first, duplicate] = await Promise.all([
      send(clientIds[index], index),
      send(clientIds[index], index),
    ])
    assert.equal(first.id, duplicate.id, `retry ${index + 1} created a duplicate`)
    persisted.push(first)
  }

  const { data: stored, error: storedError } = await reader
    .from('messages')
    .select('id, client_message_id, sequence_no')
    .eq('room_id', roomId)
    .in('client_message_id', clientIds)
  if (storedError) throw storedError
  assert.equal(stored.length, count, 'stored message count differs from requested count')
  assert.equal(new Set(stored.map(message => message.id)).size, count, 'duplicate server ids found')
  assert.equal(new Set(stored.map(message => message.sequence_no)).size, count, 'duplicate sequences found')

  const latest = [...stored].sort((left, right) => Number(left.sequence_no) - Number(right.sequence_no)).at(-1)
  const { data: cursorResult, error: cursorError } = await reader.rpc('advance_room_read_cursor', {
    p_room_id: roomId,
    p_message_id: latest.id,
  })
  if (cursorError) throw cursorError
  const cursor = Array.isArray(cursorResult) ? cursorResult[0] : cursorResult
  assert.equal(Number(cursor.last_read_sequence), Number(latest.sequence_no), 'reader cursor did not advance')

  const { data: visibleCursor, error: visibleCursorError } = await sender
    .from('room_read_cursors')
    .select('last_read_sequence')
    .eq('room_id', roomId)
    .eq('user_id', readerUser.id)
    .single()
  if (visibleCursorError) throw visibleCursorError
  assert.equal(Number(visibleCursor.last_read_sequence), Number(latest.sequence_no), 'sender cannot observe reader cursor')

  const missingRealtime = clientIds.filter(id => !receivedIds.has(id))
  if (missingRealtime.length > 0) {
    console.warn(`Realtime did not deliver ${missingRealtime.length} event(s); reconciliation recovered all rows.`)
  }

  console.log(JSON.stringify({
    sent: count,
    stored: stored.length,
    realtimeReceived: receivedIds.size,
    duplicateRows: 0,
    cursorSequence: Number(visibleCursor.last_read_sequence),
  }, null, 2))
} finally {
  if (channel) await reader.removeChannel(channel)
  await Promise.allSettled([sender.auth.signOut(), reader.auth.signOut()])
}
