import { beforeEach, describe, expect, it } from 'vitest'
import { UI_MODES, applyUiMode, getStoredUiMode, saveUiMode } from './uiMode'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.uiMode
})

describe('ui mode', () => {
  it('uses modern mode by default and for unknown values', () => {
    expect(getStoredUiMode()).toBe(UI_MODES.MODERN)
    localStorage.setItem('idea-ui-mode', 'unknown')
    expect(getStoredUiMode()).toBe(UI_MODES.MODERN)
  })

  it('persists and applies modern mode', () => {
    expect(saveUiMode(UI_MODES.MODERN)).toBe(UI_MODES.MODERN)
    expect(localStorage.getItem('idea-ui-mode')).toBe(UI_MODES.MODERN)
    expect(document.documentElement.dataset.uiMode).toBe(UI_MODES.MODERN)
  })

  it('keeps an explicitly selected classic mode', () => {
    localStorage.setItem('idea-ui-mode', UI_MODES.CLASSIC)
    expect(getStoredUiMode()).toBe(UI_MODES.CLASSIC)
  })

  it('applies modern mode for an invalid value to the requested root', () => {
    const root = { dataset: {} }
    expect(applyUiMode('invalid', root)).toBe(UI_MODES.MODERN)
    expect(root.dataset.uiMode).toBe(UI_MODES.MODERN)
  })
})
