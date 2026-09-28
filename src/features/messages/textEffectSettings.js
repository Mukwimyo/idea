export const TEXT_EFFECT_ENTRY_MODES = ['instant', 'jamo', 'syllable', 'decode', 'hesitate', 'correct']
export const TEXT_EFFECT_MODIFIERS = ['twist', 'runaway', 'disconnect']

export const DEFAULT_TEXT_EFFECT_SETTINGS = Object.freeze({
  entryMode: 'jamo',
  entryMotion: 'stationary',
  modifiers: [],
  intensity: 49,
  irregularity: 64,
  letterSpacing: 0,
  speed: 4,
  autoAccelerate: true,
  animate: true,
})

const numberInRange = (value, fallback, min, max) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

export function normalizeTextEffectSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    entryMode: TEXT_EFFECT_ENTRY_MODES.includes(source.entryMode) ? source.entryMode : DEFAULT_TEXT_EFFECT_SETTINGS.entryMode,
    entryMotion: source.entryMotion === 'rise' ? 'rise' : DEFAULT_TEXT_EFFECT_SETTINGS.entryMotion,
    modifiers: Array.isArray(source.modifiers)
      ? [...new Set(source.modifiers.filter(modifier => TEXT_EFFECT_MODIFIERS.includes(modifier)))]
      : [],
    intensity: numberInRange(source.intensity, DEFAULT_TEXT_EFFECT_SETTINGS.intensity, 0, 100),
    irregularity: numberInRange(source.irregularity, DEFAULT_TEXT_EFFECT_SETTINGS.irregularity, 0, 100),
    letterSpacing: numberInRange(source.letterSpacing, DEFAULT_TEXT_EFFECT_SETTINGS.letterSpacing, -2, 6),
    speed: numberInRange(source.speed, DEFAULT_TEXT_EFFECT_SETTINGS.speed, 0.5, 5),
    autoAccelerate: source.autoAccelerate !== false,
    animate: source.animate !== false,
  }
}

export function effectiveTextEffectSpeed(settings, characterCount) {
  const normalized = normalizeTextEffectSettings(settings)
  if (!normalized.autoAccelerate || characterCount <= 22) return normalized.speed
  return Math.min(5, normalized.speed * Math.sqrt(characterCount / 22))
}

const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

export function getHangulCompositionParts(character) {
  const code = character.codePointAt(0)
  if (code < 0xac00 || code > 0xd7a3) return [character]
  const offset = code - 0xac00
  const initialIndex = Math.floor(offset / 588)
  const vowelIndex = Math.floor((offset % 588) / 28)
  const finalIndex = offset % 28
  const openSyllable = String.fromCodePoint(0xac00 + initialIndex * 588 + vowelIndex * 28)
  return finalIndex === 0
    ? [INITIALS[initialIndex], character]
    : [INITIALS[initialIndex], openSyllable, character]
}

export function buildTextEffectFrames(text, settings) {
  const normalized = normalizeTextEffectSettings(settings)
  if (!normalized.animate || normalized.entryMode === 'instant') return [text]
  const frames = []
  let completed = ''
  for (const character of [...text]) {
    const parts = normalized.entryMode === 'jamo'
      ? getHangulCompositionParts(character)
      : normalized.entryMode === 'decode'
        ? ['·', '◇', character]
        : normalized.entryMode === 'hesitate'
          ? ['…', character]
          : normalized.entryMode === 'correct'
            ? ['×', character]
            : [character]
    for (const part of parts) frames.push(completed + part)
    completed += character
  }
  return frames.length ? frames : ['']
}

export function textEffectDurationMs(text, settings) {
  const normalized = normalizeTextEffectSettings(settings)
  if (!normalized.animate || normalized.entryMode === 'instant') return 0
  const frameCount = buildTextEffectFrames(text, normalized).length
  const delay = Math.max(12, 100 / effectiveTextEffectSpeed(normalized, [...text].length))
  const disconnectPauses = normalized.modifiers.includes('disconnect') ? Math.floor(frameCount / 6) : 0
  return Math.ceil(Math.max(0, frameCount - 1) * delay + disconnectPauses * delay * 3.2)
}

export function createSeededRandom(seedValue) {
  let seed = 2166136261
  for (const character of String(seedValue || 'idea')) {
    seed ^= character.codePointAt(0)
    seed = Math.imul(seed, 16777619)
  }
  return () => {
    seed += 0x6d2b79f5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
