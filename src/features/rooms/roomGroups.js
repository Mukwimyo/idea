export const UNASSIGNED_ROOM_GROUP_ID = 'unassigned'

export const fetchRoomGroups = async supabase => {
  const { data, error } = await supabase
    .from('room_groups')
    .select('id, name, sort_order')
    .order('sort_order')
    .order('created_at')

  if (error) throw error
  return data || []
}

export const createRoomGroup = async (supabase, name, sortOrder) => {
  const { data, error } = await supabase
    .from('room_groups')
    .insert({ name: name.trim(), sort_order: sortOrder })
    .select('id, name, sort_order')
    .single()

  if (error) throw error
  return data
}

export const createRoomInGroup = async (supabase, name, roomGroupId) => {
  const { data, error } = await supabase.rpc('create_room_in_group', {
    p_name: name.trim(),
    p_room_group_id: roomGroupId || null,
  })

  if (error) throw error
  return Array.isArray(data) ? data[0] || null : data || null
}

export const moveRoomToGroup = async (supabase, roomId, roomGroupId) => {
  const { error } = await supabase.rpc('move_room_to_group', {
    p_room_id: roomId,
    p_room_group_id: roomGroupId || null,
  })

  if (error) throw error
}

export const deleteRoomGroup = async (supabase, roomGroupId) => {
  const { error } = await supabase.from('room_groups').delete().eq('id', roomGroupId)
  if (error) throw error
}

export const buildRoomGroupSections = (rooms, groups, sortRooms) => {
  const knownGroupIds = new Set(groups.map(group => group.id))
  const sections = groups.map(group => ({
    ...group,
    rooms: sortRooms(rooms.filter(room => room.room_group_id === group.id)),
  }))
  const unassignedRooms = sortRooms(rooms.filter(room =>
    !room.room_group_id || !knownGroupIds.has(room.room_group_id)
  ))

  if (unassignedRooms.length > 0 || sections.length === 0) {
    sections.push({
      id: UNASSIGNED_ROOM_GROUP_ID,
      name: '미분류',
      sort_order: Number.MAX_SAFE_INTEGER,
      rooms: unassignedRooms,
    })
  }

  return sections
}
