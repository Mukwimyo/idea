export const PENDING_MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const storageKey = userId => `idea-pending-messages:${userId}`

const isValidEntry = entry =>
  Boolean(entry?.tempId && entry?.roomId && entry?.message?.client_message_id && entry?.queuedAt)

export const readPendingMessages = (storage, userId, now = Date.now()) => {
  if (!storage || !userId) return []

  try {
    const entries = JSON.parse(storage.getItem(storageKey(userId)) || '[]')
    const freshEntries = Array.isArray(entries)
      ? entries.filter(entry => isValidEntry(entry) && now - entry.queuedAt <= PENDING_MESSAGE_TTL_MS)
      : []

    if (freshEntries.length !== entries.length) {
      storage.setItem(storageKey(userId), JSON.stringify(freshEntries))
    }
    return freshEntries
  } catch {
    storage.removeItem(storageKey(userId))
    return []
  }
}

export const queuePendingMessage = (storage, userId, entry, now = Date.now()) => {
  const entries = readPendingMessages(storage, userId, now).filter(
    queued => queued.message.client_message_id !== entry.message.client_message_id
  )
  const next = [...entries, { ...entry, queuedAt: entry.queuedAt || now }]
  storage.setItem(storageKey(userId), JSON.stringify(next))
  return next
}

export const removePendingMessage = (storage, userId, clientMessageId, now = Date.now()) => {
  const next = readPendingMessages(storage, userId, now).filter(
    entry => entry.message.client_message_id !== clientMessageId
  )
  storage.setItem(storageKey(userId), JSON.stringify(next))
  return next
}

export const clearPendingMessages = (storage, userId) => {
  if (storage && userId) storage.removeItem(storageKey(userId))
}

export const migrateLegacyPendingMessages = (storage, userId, now = Date.now()) => {
  if (!storage || !userId) return 0

  try {
    const legacy = JSON.parse(storage.getItem('idea-pending-messages') || '[]')
    if (!Array.isArray(legacy)) {
      storage.removeItem('idea-pending-messages')
      return 0
    }

    const owned = legacy.filter(entry => entry?.message?.user_id === userId)
    const remaining = legacy.filter(entry => entry?.message?.user_id !== userId)
    for (const item of owned) {
      const clientMessageId = item.message.client_message_id || crypto.randomUUID()
      queuePendingMessage(
        storage,
        userId,
        {
          ...item,
          message: { ...item.message, client_message_id: clientMessageId },
        },
        now
      )
    }

    if (remaining.length > 0) storage.setItem('idea-pending-messages', JSON.stringify(remaining))
    else storage.removeItem('idea-pending-messages')
    return owned.length
  } catch {
    storage.removeItem('idea-pending-messages')
    return 0
  }
}
