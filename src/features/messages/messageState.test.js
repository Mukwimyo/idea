import { describe, expect, it } from 'vitest'
import { highestReadableMessage, mergeMessages } from './messageState'

describe('mergeMessages', () => {
  it('replaces an optimistic message by client id without duplicating it', () => {
    const optimistic = {
      id: 'temp-1',
      client_message_id: 'client-1',
      content: 'hello',
      created_at: '2026-01-01T00:00:00Z',
      delivery_state: 'sending',
      characters: { name: 'A' },
    }
    const persisted = {
      id: 'server-1',
      client_message_id: 'client-1',
      content: 'hello',
      created_at: '2026-01-01T00:00:01Z',
      sequence_no: 7,
    }

    expect(mergeMessages([optimistic], persisted)).toEqual([
      expect.objectContaining({
        id: 'server-1',
        client_message_id: 'client-1',
        delivery_state: undefined,
        characters: { name: 'A' },
      }),
    ])
  })

  it('deduplicates the same realtime row received more than once', () => {
    const message = { id: 'server-1', sequence_no: 1, created_at: '2026-01-01T00:00:00Z' }
    expect(mergeMessages([message], message)).toHaveLength(1)
  })

  it('orders persisted messages by server sequence', () => {
    const result = mergeMessages(
      [{ id: 'later', sequence_no: 2, created_at: '2026-01-01T00:00:00Z' }],
      { id: 'earlier', sequence_no: 1, created_at: '2026-01-01T00:00:01Z' }
    )
    expect(result.map(message => message.id)).toEqual(['earlier', 'later'])
  })
})

describe('highestReadableMessage', () => {
  it('ignores own, chapter, and optimistic messages', () => {
    const result = highestReadableMessage(
      [
        { id: 'one', user_id: 'other', type: 'chat', sequence_no: 1 },
        { id: 'two', user_id: 'me', type: 'chat', sequence_no: 5 },
        { id: 'three', user_id: 'other', type: 'chapter', sequence_no: 6 },
        { id: 'temp-4', user_id: 'other', type: 'chat', sequence_no: 7 },
        { id: 'four', user_id: 'other', type: 'chat', sequence_no: 4 },
      ],
      'me'
    )
    expect(result.id).toBe('four')
  })
})
