import { describe, expect, it, vi } from 'vitest'
import {
  getRoomCharacterPoolErrorMessage,
  replaceRoomCharacterPool,
} from './roomCharacterPoolApi'

describe('room character pool RPC API', () => {
  it('sends the ordered character ids without a caller-controlled user id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { character_id: 'character-2', sort_order: 0 },
        { character_id: 'character-1', sort_order: 1 },
      ],
      error: null,
    })

    const result = await replaceRoomCharacterPool(
      { rpc },
      'room-1',
      ['character-2', 'character-1']
    )

    expect(rpc).toHaveBeenCalledWith('replace_room_character_pool', {
      p_room_id: 'room-1',
      p_character_ids: ['character-2', 'character-1'],
    })
    expect(result).toHaveLength(2)
  })

  it('surfaces the database failure without losing its diagnostic details', async () => {
    const error = { code: '42501', message: 'room membership required' }
    const rpc = vi.fn().mockResolvedValue({ data: null, error })

    await expect(
      replaceRoomCharacterPool({ rpc }, 'room-1', ['character-1'])
    ).rejects.toBe(error)
    expect(getRoomCharacterPoolErrorMessage(error)).toContain('참여 정보')
  })

  it('explains when the required server migration is missing', () => {
    expect(getRoomCharacterPoolErrorMessage({ code: 'PGRST202' })).toBe(
      '새 저장 기능이 아직 서버에 적용되지 않았어요.'
    )
  })

  it('uses a safe fallback for an unknown database error', () => {
    expect(getRoomCharacterPoolErrorMessage({ message: 'offline' })).toContain(
      '잠시 후 다시 시도'
    )
  })
})
