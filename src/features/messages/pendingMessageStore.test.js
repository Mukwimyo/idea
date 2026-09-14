import { beforeEach, describe, expect, it } from 'vitest'
import {
  PENDING_MESSAGE_TTL_MS,
  clearPendingMessages,
  queuePendingMessage,
  readPendingMessages,
  removePendingMessage,
} from './pendingMessageStore'

const entry = (clientId = 'client-1') => ({
  tempId: `temp-${clientId}`,
  roomId: 'room-1',
  message: { client_message_id: clientId, content: 'hello' },
})

describe('pendingMessageStore', () => {
  beforeEach(() => localStorage.clear())

  it('isolates queues by account', () => {
    queuePendingMessage(localStorage, 'user-a', entry(), 100)
    expect(readPendingMessages(localStorage, 'user-a', 100)).toHaveLength(1)
    expect(readPendingMessages(localStorage, 'user-b', 100)).toEqual([])
  })

  it('keeps only one retry for the same client id', () => {
    queuePendingMessage(localStorage, 'user-a', entry(), 100)
    queuePendingMessage(localStorage, 'user-a', entry(), 200)
    expect(readPendingMessages(localStorage, 'user-a', 200)).toHaveLength(1)
  })

  it('expires entries after seven days', () => {
    queuePendingMessage(localStorage, 'user-a', entry(), 100)
    expect(readPendingMessages(localStorage, 'user-a', 100 + PENDING_MESSAGE_TTL_MS + 1)).toEqual([])
  })

  it('removes one entry or clears the account queue', () => {
    queuePendingMessage(localStorage, 'user-a', entry('client-1'), 100)
    queuePendingMessage(localStorage, 'user-a', entry('client-2'), 100)
    removePendingMessage(localStorage, 'user-a', 'client-1', 100)
    expect(readPendingMessages(localStorage, 'user-a', 100)[0].message.client_message_id).toBe('client-2')
    clearPendingMessages(localStorage, 'user-a')
    expect(readPendingMessages(localStorage, 'user-a', 100)).toEqual([])
  })
})
