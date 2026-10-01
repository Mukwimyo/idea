import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEXT_EFFECT_SETTINGS,
  buildTextEffectFrames,
  effectiveTextEffectSpeed,
  getHangulCompositionParts,
  normalizeTextEffectSettings,
  textEffectDurationMs,
} from './textEffectSettings'

describe('textEffectSettings', () => {
  it('uses the requested global defaults', () => {
    expect(normalizeTextEffectSettings()).toEqual(DEFAULT_TEXT_EFFECT_SETTINGS)
    expect(DEFAULT_TEXT_EFFECT_SETTINGS.letterSpacing).toBe(0)
  })

  it('drops unsupported modifiers and clamps numeric values', () => {
    expect(normalizeTextEffectSettings({ modifiers: ['twist', 'echo'], speed: 20, letterSpacing: -9 })).toMatchObject({
      modifiers: ['twist'], speed: 5, letterSpacing: -2,
    })
  })

  it('builds Korean jamo composition frames in place', () => {
    expect(getHangulCompositionParts('한')).toEqual(['ㅎ', '하', '한'])
    expect(DEFAULT_TEXT_EFFECT_SETTINGS.entryMode).toBe('instant')
    expect(buildTextEffectFrames('한!', DEFAULT_TEXT_EFFECT_SETTINGS)).toEqual(['한!'])
  })

  it('accelerates long messages without exceeding the maximum', () => {
    expect(effectiveTextEffectSpeed(DEFAULT_TEXT_EFFECT_SETTINGS, 22)).toBe(4)
    expect(effectiveTextEffectSpeed(DEFAULT_TEXT_EFFECT_SETTINGS, 220)).toBe(5)
  })

  it('estimates enough time for the presentation effect to finish first', () => {
    expect(textEffectDurationMs('안녕', DEFAULT_TEXT_EFFECT_SETTINGS)).toBe(0)
    expect(textEffectDurationMs('안녕', { ...DEFAULT_TEXT_EFFECT_SETTINGS, animate: false })).toBe(0)
  })
})
