export const replaceRoomCharacterPool = async (supabase, roomId, characterIds) => {
  const { data, error } = await supabase.rpc('replace_room_character_pool', {
    p_room_id: roomId,
    p_character_ids: characterIds,
  })

  if (error) throw error
  return data || []
}

export const getRoomCharacterPoolErrorMessage = error => {
  const message = error?.message || ''

  if (message.includes('room membership required')) {
    return '이 방의 참여 정보를 확인할 수 없어요. 방을 다시 연 뒤 시도해 주세요.'
  }
  if (message.includes('character selection is empty')) {
    return '방에서 사용할 캐릭터를 최소 1명 선택해 주세요.'
  }
  if (message.includes('character selection contains duplicates')) {
    return '캐릭터 선택 목록이 올바르지 않아요. 목록을 다시 불러온 뒤 시도해 주세요.'
  }
  if (message.includes('character ownership required')) {
    return '선택한 캐릭터 중 사용할 수 없는 캐릭터가 있어요. 목록을 다시 불러왔습니다.'
  }
  if (error?.code === 'PGRST202' || message.includes('replace_room_character_pool')) {
    return '새 저장 기능이 아직 서버에 적용되지 않았어요.'
  }

  return '방 캐릭터 목록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
}
