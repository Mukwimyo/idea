import { useEffect } from 'react'

function relativeLuminance(hex) {
  const [red, green, blue] = hex.slice(1).match(/../g).map(channel => {
    const srgb = Number.parseInt(channel, 16) / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first, second) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

export function themeToCssVars(theme) {
  const white = '#ffffff'
  const dark = '#111111'
  const accentLuminance = relativeLuminance(theme.point)
  const whiteContrast = contrastRatio(accentLuminance, 1)
  const darkContrast = contrastRatio(accentLuminance, relativeLuminance(dark))

  return {
    '--c-bg': theme.bg,
    '--c-surface': theme.panel,
    '--c-border': theme.border,
    '--c-accent': theme.point,
    '--c-text': theme.theirText,
    '--c-text-sub': theme.subText,
    '--c-narration': theme.narrColor,
    '--c-chapter': theme.chapColor,
    '--c-bubble-mine': theme.myBubble,
    '--c-bubble-mine-text': theme.myText,
    '--c-bubble-mine-act': theme.myAct,
    '--c-bubble-their': theme.theirBubble,
    '--c-bubble-their-text': theme.theirText,
    '--c-bubble-their-border': theme.theirBorder,
    '--c-input-bg': theme.inputBg,
    '--c-input-text': theme.inputText,
    '--c-on-accent': whiteContrast >= darkContrast ? white : dark,
  }
}

export function applyThemeVars(theme) {
  if (!theme || typeof document === 'undefined') return

  const root = document.documentElement
  for (const [name, value] of Object.entries(themeToCssVars(theme))) {
    root.style.setProperty(name, value)
  }
  root.dataset.themeTone = theme.dark ? 'dark' : 'light'
}

export function useThemeVars(theme) {
  useEffect(() => {
    applyThemeVars(theme)
  }, [theme])
}
