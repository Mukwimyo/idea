import { describe, expect, it, vi } from 'vitest'
import { advanceRoomReadCursor, fetchRoomMessages, joinRoomWithInvite, sendRoomMessage } from './messageApi'

const createMessageQuery = data => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    lt: vi.fn(() => query),
    then: resolve => resolve({ data, error: null }),
  }
  return query
}

describe('message history API', () => {
  it('loads the newest page and returns it in timeline order', async () => {
    const query = createMessageQuery([{ id: '3', sequence_no: 3 }, { id: '2', sequence_no: 2 }, { id: '1', sequence_no: 1 }])
    const result = await fetchRoomMessages({ from: vi.fn(() => query) }, 'room-1', { pageSize: 2 })

    expect(query.order).toHaveBeenCalledWith('sequence_no', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(3)
    expect(query.lt).not.toHaveBeenCalled()
    expect(result).toEqual({
      messages: [{ id: '2', sequence_no: 2 }, { id: '3', sequence_no: 3 }],
      hasMore: true,
    })
  })

  it('uses the oldest loaded sequence as a stable history cursor', async () => {
    const query = createMessageQuery([{ id: '1', sequence_no: 1 }])
    const result = await fetchRoomMessages({ from: vi.fn(() => query) }, 'room-1', {
      beforeSequence: 2,
      pageSize: 200,
    })

    expect(query.lt).toHaveBeenCalledWith('sequence_no', 2)
    expect(result.hasMore).toBe(false)
  })
})

describe('message RPC API', () => {
  it('never sends a caller-controlled user id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'server-1' }, error: null })
    const result = await sendRoomMessage(
      { rpc },
      {
        room_id: 'room-1',
        user_id: 'forged-user',
        client_message_id: 'client-1',
        character_id: 'character-1',
        type: 'chat',
        content: 'hello',
      }
    )

    expect(result.id).toBe('server-1')
    expect(rpc).toHaveBeenCalledWith('send_room_message', {
      p_room_id: 'room-1',
      p_client_message_id: 'client-1',
      p_character_id: 'character-1',
      p_type: 'chat',
      p_content: 'hello',
      p_effect_key: null,
    })
  })

  it('passes a supported presentation effect through the guarded RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'server-2' }, error: null })
    await sendRoomMessage(
      { rpc },
      {
        room_id: 'room-1',
        client_message_id: 'client-2',
        character_id: 'character-1',
        type: 'chat',
        content: 'listen',
        effect_key: 'whisper',
      }
    )

    expect(rpc).toHaveBeenCalledWith('send_room_message', expect.objectContaining({
      p_effect_key: 'whisper',
    }))
  })

  it('advances read state using a server message id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ room_id: 'room-1', user_id: 'user-1', last_read_sequence: 9 }],
      error: null,
    })
    const result = await advanceRoomReadCursor({ rpc }, 'room-1', 'message-9')
    expect(result.last_read_sequence).toBe(9)
    expect(rpc).toHaveBeenCalledWith('advance_room_read_cursor', {
      p_room_id: 'room-1',
      p_message_id: 'message-9',
    })
  })

  it('surfaces RPC failures to the retry queue', async () => {
    const error = new Error('offline')
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    await expect(
      sendRoomMessage(
        { rpc },
        {
          room_id: 'room-1',
          client_message_id: 'client-1',
          type: 'chat',
          content: 'hello',
        }
      )
    ).rejects.toBe(error)
  })

  it('joins through the guarded invite RPC without a caller user id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'room-1' }], error: null })
    const room = await joinRoomWithInvite(
      { rpc },
      ' abc123 ',
      'character-1',
      'client-1'
    )
    expect(room.id).toBe('room-1')
    expect(rpc).toHaveBeenCalledWith('join_room_with_invite', {
      p_invite_code: 'abc123',
      p_character_id: 'character-1',
      p_client_message_id: 'client-1',
      p_room_group_id: null,
    })
  })

  it('assigns an invited room to the selected personal group', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'room-1' }], error: null })
    await joinRoomWithInvite(
      { rpc },
      'abc123',
      'character-1',
      'client-1',
      'group-1'
    )

    expect(rpc).toHaveBeenCalledWith('join_room_with_invite', expect.objectContaining({
      p_room_group_id: 'group-1',
    }))
  })
})
