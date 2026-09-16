export const normalizeRoomSummaries = rows =>
  (rows || [])
    .map(row => row?.summary || row)
    .filter(room => room?.id)
    .map(room => ({
      ...room,
      unreadCount: Math.max(0, Number(room.unreadCount || 0)),
      is_favorite: room.is_favorite === true,
      sort_order: Number(room.sort_order || 0),
    }))

export const sortRoomList = (list, mode) =>
  [...list].sort((left, right) => {
    if (left.is_favorite !== right.is_favorite) return left.is_favorite ? -1 : 1
    if (mode === 'manual') return (left.sort_order ?? 0) - (right.sort_order ?? 0)
    const leftTime = left.lastMsg?.created_at || left.created_at || ''
    const rightTime = right.lastMsg?.created_at || right.created_at || ''
    return rightTime.localeCompare(leftTime)
  })
