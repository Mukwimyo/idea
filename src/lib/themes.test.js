import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, getTheme } from './themes'

function relativeLuminance(hex) {
  const [red, green, blue] = hex.slice(1).match(/../g).map(channel => {
    const srgb = Number.parseInt(channel, 16) / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

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

describe('theme text contrast', () => {
  it.each([
    'monochrome', 'gray', 'imessage', 'notion', 'twitter', 'cream',
    'lavender', 'paper', 'cotton', 'kakao-blue',
  ])('%s meets WCAG contrast against its background', themeId => {
    const theme = getTheme(themeId)
    const background = relativeLuminance(theme.bg)

    for (const field of ['subText', 'narrColor', 'chapColor']) {
      const foreground = relativeLuminance(theme[field])
      const contrast = (Math.max(foreground, background) + 0.05)
        / (Math.min(foreground, background) + 0.05)
      expect(contrast, field).toBeGreaterThanOrEqual(4.5)
    }
  })
})
