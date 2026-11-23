import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyThemeVars, themeToCssVars, useThemeVars } from './themeVars'
import { THEMES } from './themes'

const roleKeys = {
  '--c-bg': 'bg',
  '--c-surface': 'panel',
  '--c-border': 'border',
  '--c-accent': 'point',
  '--c-text': 'theirText',
  '--c-text-sub': 'subText',
  '--c-narration': 'narrColor',
  '--c-chapter': 'chapColor',
  '--c-bubble-mine': 'myBubble',
  '--c-bubble-mine-text': 'myText',
  '--c-bubble-mine-act': 'myAct',
  '--c-bubble-their': 'theirBubble',
  '--c-bubble-their-text': 'theirText',
  '--c-bubble-their-border': 'theirBorder',
  '--c-input-bg': 'inputBg',
  '--c-input-text': 'inputText',
}

const translucentMyActThemes = new Set(['imessage', 'twitter', 'lavender', 'cotton'])

function luminance(hex) {
  return [0.2126, 0.7152, 0.0722].reduce((total, weight, index) => {
    const start = 1 + index * 2
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return total + weight * linear
  }, 0)
}

describe('themeToCssVars', () => {
  it.each(THEMES)('$id maps all 16 roles and uses the higher-contrast accent text', theme => {
    const vars = themeToCssVars(theme)
    expect(Object.keys(vars)).toHaveLength(17)

    for (const [variable, key] of Object.entries(roleKeys)) {
      expect(vars[variable], variable).toBe(theme[key])
      if (key === 'myAct' && translucentMyActThemes.has(theme.id)) {
        expect(vars[variable], variable).toBe('rgba(255,255,255,0.6)')
      } else {
        expect(vars[variable], variable).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }

    const contrast = color => {
      const [low, high] = [luminance(theme.point), luminance(color)].sort((a, b) => a - b)
      return (high + 0.05) / (low + 0.05)
    }
    const selected = vars['--c-on-accent']
    expect(['#ffffff', '#111111']).toContain(selected)
    expect(contrast(selected)).toBe(Math.max(contrast('#ffffff'), contrast('#111111')))
  })

  it.each([
    ['#ffffff', '#111111'],
    ['#000000', '#ffffff'],
  ])('uses %s as the accent with %s text', (point, expected) => {
    expect(themeToCssVars({ ...THEMES[0], point })['--c-on-accent']).toBe(expected)
  })
})

describe('applying theme variables', () => {
  const darkTheme = THEMES.find(theme => theme.dark)
  const lightTheme = THEMES.find(theme => !theme.dark)
  const root = document.documentElement

  afterEach(() => {
    for (const name of [...Object.keys(roleKeys), '--c-on-accent']) {
      root.style.removeProperty(name)
    }
    delete root.dataset.themeTone
  })

  it('sets the root variables and tone and ignores a missing theme', () => {
    applyThemeVars(darkTheme)
    for (const [name, value] of Object.entries(themeToCssVars(darkTheme))) {
      expect(root.style.getPropertyValue(name), name).toBe(value)
    }
    expect(root.dataset.themeTone).toBe('dark')

    applyThemeVars(null)
    expect(root.style.getPropertyValue('--c-bg')).toBe(darkTheme.bg)
    expect(root.dataset.themeTone).toBe('dark')
  })

  it('updates on a theme change and leaves the last theme applied on unmount', () => {
    const { rerender, unmount } = renderHook(({ theme }) => useThemeVars(theme), {
      initialProps: { theme: darkTheme },
    })
    expect(root.style.getPropertyValue('--c-bg')).toBe(darkTheme.bg)

    rerender({ theme: lightTheme })
    expect(root.style.getPropertyValue('--c-bg')).toBe(lightTheme.bg)
    expect(root.dataset.themeTone).toBe('light')

    unmount()
    expect(root.style.getPropertyValue('--c-bg')).toBe(lightTheme.bg)
    expect(root.dataset.themeTone).toBe('light')
  })
})
