import { describe, expect, it, vi } from 'vitest'
import { advanceRoomReadCursor, joinRoomWithInvite, sendRoomMessage } from './messageApi'

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
    })
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
    })
  })
})
