import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, getTheme } from './themes'

describe('theme defaults', () => {
  it('uses monochrome when no valid theme is available', () => {
    expect(DEFAULT_THEME_ID).toBe('monochrome')
    expect(getTheme()).toMatchObject({ id: 'monochrome', bg: '#111111' })
    expect(getTheme('unknown-theme').id).toBe('monochrome')
  })

  it('keeps an explicitly selected theme', () => {
    expect(getTheme('forest').id).toBe('forest')
  })
})
