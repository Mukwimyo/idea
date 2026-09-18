import { describe, expect, it, vi } from 'vitest'
import {
  UNASSIGNED_ROOM_GROUP_ID,
  buildRoomGroupSections,
  createRoomInGroup,
  moveRoomToGroup,
} from './roomGroups'

describe('room groups', () => {
  it('keeps existing rooms in a synthetic unassigned section', () => {
    const sections = buildRoomGroupSections(
      [
        { id: 'bridge', room_group_id: 'space' },
        { id: 'old-room', room_group_id: null },
      ],
      [{ id: 'space', name: '우주모험', sort_order: 0 }],
      rooms => rooms
    )

    expect(sections.map(section => section.id)).toEqual(['space', UNASSIGNED_ROOM_GROUP_ID])
    expect(sections[0].rooms[0].id).toBe('bridge')
    expect(sections[1].rooms[0].id).toBe('old-room')
  })

  it('does not hide rooms while their group metadata is unavailable', () => {
    const sections = buildRoomGroupSections(
      [{ id: 'bridge', room_group_id: 'not-loaded-yet' }],
      [],
      rooms => rooms
    )

    expect(sections[0].id).toBe(UNASSIGNED_ROOM_GROUP_ID)
    expect(sections[0].rooms[0].id).toBe('bridge')
  })

  it('creates a room without sending a caller-controlled user id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'room-1' }], error: null })
    await createRoomInGroup({ rpc }, ' 선장실 ', 'space')

    expect(rpc).toHaveBeenCalledWith('create_room_in_group', {
      p_name: '선장실',
      p_room_group_id: 'space',
    })
  })

  it('moves a room to the unassigned section with a null group id', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })

    await moveRoomToGroup({ rpc }, 'room-1', '')

    expect(rpc).toHaveBeenCalledWith('move_room_to_group', {
      p_room_id: 'room-1',
      p_room_group_id: null,
    })
  })
})
