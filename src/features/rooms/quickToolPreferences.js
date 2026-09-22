export const QUICK_TOOL_STORAGE_KEY = 'idea-room-quick-tool'
export const FAVORITE_TOOLS_STORAGE_KEY = 'idea-room-favorite-tools'
export const DEFAULT_QUICK_TOOL = 'narration'

export const QUICK_TOOL_IDS = [
  'image', 'narration', 'divider', 'effects', 'communication',
  'audio', 'invite', 'locations', 'notes', 'random',
]

const quickToolIdSet = new Set(QUICK_TOOL_IDS)

export function normalizeFavoriteTools(value, fallback = DEFAULT_QUICK_TOOL) {
  const source = Array.isArray(value) ? value : []
  const favorites = [...new Set(source.filter(toolId => quickToolIdSet.has(toolId)))]
  if (favorites.length > 0) return favorites
  return [quickToolIdSet.has(fallback) ? fallback : DEFAULT_QUICK_TOOL]
}

export function readQuickToolPreferences(storage) {
  const legacyActiveId = storage?.getItem(QUICK_TOOL_STORAGE_KEY) || DEFAULT_QUICK_TOOL
  let storedFavorites

  try {
    storedFavorites = JSON.parse(storage?.getItem(FAVORITE_TOOLS_STORAGE_KEY) || '[]')
  } catch {
    storedFavorites = []
  }

  const favorites = normalizeFavoriteTools(storedFavorites, legacyActiveId)
  const activeId = favorites.includes(legacyActiveId) ? legacyActiveId : favorites[0]
  return { activeId, favorites }
}

export function writeQuickToolPreferences(storage, preferences) {
  const favorites = normalizeFavoriteTools(preferences?.favorites, preferences?.activeId)
  const activeId = favorites.includes(preferences?.activeId) ? preferences.activeId : favorites[0]

  storage?.setItem(QUICK_TOOL_STORAGE_KEY, activeId)
  storage?.setItem(FAVORITE_TOOLS_STORAGE_KEY, JSON.stringify(favorites))
  return { activeId, favorites }
}

export function toggleFavoriteTool(preferences, toolId) {
  const favorites = normalizeFavoriteTools(preferences?.favorites, preferences?.activeId)
  if (!quickToolIdSet.has(toolId)) return { ...preferences, favorites, changed: false }

  if (favorites.includes(toolId)) {
    if (favorites.length === 1) return { activeId: favorites[0], favorites, changed: false }
    const nextFavorites = favorites.filter(id => id !== toolId)
    return {
      activeId: preferences.activeId === toolId ? nextFavorites[0] : preferences.activeId,
      favorites: nextFavorites,
      changed: true,
    }
  }

  return { activeId: toolId, favorites: [...favorites, toolId], changed: true }
}
