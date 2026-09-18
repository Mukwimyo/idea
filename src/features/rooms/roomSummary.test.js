import { describe, expect, it } from 'vitest'
import { normalizeRoomSummaries, sortRoomList } from './roomSummary'

describe('room summaries', () => {
  it('normalizes RPC wrapper rows and unread counts', () => {
    expect(
      normalizeRoomSummaries([
        { summary: { id: 'room-1', unreadCount: '3', is_favorite: true, sort_order: '2', room_group_id: 'space' } },
      ])
    ).toEqual([
      expect.objectContaining({ id: 'room-1', unreadCount: 3, is_favorite: true, sort_order: 2, room_group_id: 'space' }),
    ])
  })

  it('keeps favorites first and then uses latest activity', () => {
    const result = sortRoomList(
      [
        { id: 'old-favorite', is_favorite: true, lastMsg: { created_at: '2026-01-01' } },
        { id: 'new', is_favorite: false, lastMsg: { created_at: '2026-03-01' } },
        { id: 'old', is_favorite: false, lastMsg: { created_at: '2026-02-01' } },
      ],
      'recent'
    )
    expect(result.map(room => room.id)).toEqual(['old-favorite', 'new', 'old'])
  })
})
