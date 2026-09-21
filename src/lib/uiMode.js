export const UI_MODE_STORAGE_KEY = 'idea-ui-mode'

export const UI_MODES = Object.freeze({
  CLASSIC: 'classic',
  MODERN: 'modern',
})

export const normalizeUiMode = value => value === UI_MODES.MODERN ? UI_MODES.MODERN : UI_MODES.CLASSIC

export const getStoredUiMode = (storage = globalThis.localStorage) => {
  try {
    return normalizeUiMode(storage?.getItem(UI_MODE_STORAGE_KEY))
  } catch {
    return UI_MODES.CLASSIC
  }
}

export const applyUiMode = (mode, root = globalThis.document?.documentElement) => {
  const normalized = normalizeUiMode(mode)
  if (root) root.dataset.uiMode = normalized
  return normalized
}

export const saveUiMode = (mode, storage = globalThis.localStorage, root = globalThis.document?.documentElement) => {
  const normalized = applyUiMode(mode, root)
  try {
    storage?.setItem(UI_MODE_STORAGE_KEY, normalized)
  } catch {
    // The visual mode still applies for the current session when storage is unavailable.
  }
  return normalized
}

export const applyStoredUiMode = () => applyUiMode(getStoredUiMode())
