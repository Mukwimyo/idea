const timestamp = message => {
  const value = Date.parse(message?.created_at || '')
  return Number.isFinite(value) ? value : 0
}

const hasSequence = message => Number.isFinite(Number(message?.sequence_no))

export const compareMessages = (left, right) => {
  if (hasSequence(left) && hasSequence(right)) {
    const sequenceDifference = Number(left.sequence_no) - Number(right.sequence_no)
    if (sequenceDifference !== 0) return sequenceDifference
  }

  const timeDifference = timestamp(left) - timestamp(right)
  if (timeDifference !== 0) return timeDifference
  return String(left?.id || '').localeCompare(String(right?.id || ''))
}

const matchesMessage = (left, right) => {
  if (left?.id && right?.id && left.id === right.id) return true
  return Boolean(
    left?.client_message_id &&
      right?.client_message_id &&
      left.client_message_id === right.client_message_id
  )
}

export const mergeMessages = (current, incoming) => {
  const merged = [...current]

  for (const next of Array.isArray(incoming) ? incoming : [incoming]) {
    if (!next) continue
    const existingIndex = merged.findIndex(message => matchesMessage(message, next))
    if (existingIndex === -1) {
      merged.push(next)
      continue
    }

    const existing = merged[existingIndex]
    merged[existingIndex] = {
      ...existing,
      ...next,
      characters: next.characters ?? existing.characters ?? null,
      delivery_state: next.id?.toString().startsWith('temp-') ? next.delivery_state : undefined,
    }
  }

  return merged.sort(compareMessages)
}

export const highestReadableMessage = (messages, userId) =>
  [...messages]
    .filter(
      message =>
        message &&
        message.user_id !== userId &&
        message.type !== 'chapter' &&
        !String(message.id).startsWith('temp-') &&
        hasSequence(message)
    )
    .sort(compareMessages)
    .at(-1) || null
