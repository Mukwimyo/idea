import { memo, useEffect, useMemo, useState } from 'react'
import {
  buildTextEffectFrames,
  createSeededRandom,
  effectiveTextEffectSpeed,
  normalizeTextEffectSettings,
} from '../features/messages/textEffectSettings'

function StyledText({ text, settings, seed }) {
  const intensity = settings.intensity / 100
  const irregularity = settings.irregularity / 100
  const twist = settings.modifiers.includes('twist')
  const runaway = settings.modifiers.includes('runaway')
  const characters = [...text]
  const characterCount = characters.length
  const characterStyles = useMemo(() => {
    const random = createSeededRandom(seed)
    return Array.from({ length: characterCount }, (_, index) => {
      const progress = characterCount > 1 ? index / (characterCount - 1) : 0
      const rotation = twist ? (random() * 2 - 1) * 13 * intensity * (0.45 + irregularity) : 0
      const offset = twist ? (random() * 2 - 1) * 1.7 * intensity * irregularity : 0
      const scale = 1 + (twist ? (random() * 2 - 1) * 0.1 * intensity : 0) + (runaway ? progress * 0.15 * intensity : 0)
      return {
        transform: `translateY(${offset}px) rotate(${rotation}deg) scale(${scale})`,
        fontWeight: runaway ? Math.round(400 + progress * 280 * intensity) : undefined,
      }
    })
  }, [characterCount, intensity, irregularity, runaway, seed, twist])

  return characters.map((character, index) => {
    return (
      <span
        key={`${index}-${character}`}
        aria-hidden="true"
        style={{
          display: 'inline-block',
          whiteSpace: character === ' ' ? 'pre' : undefined,
          transform: characterStyles[index].transform,
          transformOrigin: '50% 68%',
          fontWeight: characterStyles[index].fontWeight,
        }}>
        {character}
      </span>
    )
  })
}

function AnimatedMessageText({ text, settings: settingsValue, messageId, animateOnMount = false, renderFinal }) {
  const settings = useMemo(() => normalizeTextEffectSettings(settingsValue), [settingsValue])
  const frames = useMemo(() => buildTextEffectFrames(text, settings), [text, settings])
  const [frameIndex, setFrameIndex] = useState(frames.length - 1)
  const [replayCount, setReplayCount] = useState(0)
  const shouldAnimate = settings.animate && (animateOnMount || replayCount > 0)

  useEffect(() => {
    if (!shouldAnimate || frames.length <= 1) return undefined

    const speed = effectiveTextEffectSpeed(settings, [...text].length)
    const baseDelay = Math.max(12, 100 / speed)
    let current = 0
    let timer
    const advance = () => {
      current += 1
      setFrameIndex(current)
      if (current >= frames.length - 1) return
      const disconnectPause = settings.modifiers.includes('disconnect') && current > 0 && current % 6 === 0
      timer = window.setTimeout(advance, baseDelay * (disconnectPause ? 4.2 : 1))
    }
    timer = window.setTimeout(() => {
      setFrameIndex(0)
      timer = window.setTimeout(advance, baseDelay)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [frames, replayCount, settings, shouldAnimate, text])

  const effectiveFrameIndex = shouldAnimate ? frameIndex : frames.length - 1
  const settled = effectiveFrameIndex >= frames.length - 1
  const displayedText = frames[Math.max(0, effectiveFrameIndex)] ?? text
  const hasPersistentStyle = settings.modifiers.some(modifier => modifier === 'twist' || modifier === 'runaway')
  const replay = () => {
    if (!settings.animate) return
    setReplayCount(count => count + 1)
  }

  return (
    <span
      className={settings.entryMotion === 'rise' && !settled ? 'text-effect-rise' : undefined}
      data-text-effect
      onClick={replay}
      title={settings.animate ? '클릭하여 등장 효과 다시 보기' : undefined}
      style={{ cursor: settings.animate ? 'pointer' : undefined, letterSpacing: `${settings.letterSpacing}px` }}>
      {!settled || hasPersistentStyle
        ? <><span className="sr-only">{displayedText}</span><StyledText text={displayedText} settings={settings} seed={`${messageId}-${replayCount}`} /></>
        : (renderFinal?.() ?? text)}
    </span>
  )
}

export default memo(AnimatedMessageText)
