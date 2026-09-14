export const MESSAGE_SELECT =
  '*, characters(name, color, text_color, avatar_letter, image_url)'

export const createClientMessageId = () => crypto.randomUUID()

export const fetchRoomMessages = async (supabase, roomId) => {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('room_id', roomId)
    .order('sequence_no', { ascending: true })

  if (error) throw error
  return data || []
}

export const fetchRoomReadCursors = async (supabase, roomId) => {
  const { data, error } = await supabase
    .from('room_read_cursors')
    .select('room_id, user_id, last_read_sequence, last_read_message_id, updated_at')
    .eq('room_id', roomId)

  if (error) throw error
  return data || []
}

export const hydrateMessageCharacter = async (supabase, message) => {
  if (!message?.character_id || message.characters) return message

  const { data, error } = await supabase
    .from('characters')
    .select('name, color, text_color, avatar_letter, image_url')
    .eq('id', message.character_id)
    .maybeSingle()

  if (error) throw error
  return { ...message, characters: data || null }
}

export const sendRoomMessage = async (supabase, message) => {
  const { data, error } = await supabase.rpc('send_room_message', {
    p_room_id: message.room_id,
    p_client_message_id: message.client_message_id,
    p_character_id: message.character_id || null,
    p_type: message.type,
    p_content: message.content,
  })

  if (error) throw error
  const persisted = Array.isArray(data) ? data[0] : data
  if (!persisted?.id) throw new Error('메시지 저장 결과가 비어 있습니다.')
  return persisted
}

export const advanceRoomReadCursor = async (supabase, roomId, messageId) => {
  const { data, error } = await supabase.rpc('advance_room_read_cursor', {
    p_room_id: roomId,
    p_message_id: messageId,
  })

  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}
