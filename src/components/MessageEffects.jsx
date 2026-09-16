import { useState } from 'react'
import {
  CloudMoon,
  Megaphone,
  Sparkles,
  Vibrate,
  Volume1,
  X,
  Zap,
} from 'lucide-react'
import {
  MESSAGE_EFFECTS,
  getMessageEffect,
  getMessageEffectClassName,
} from '../features/messages/messageEffects'

const EFFECT_ICONS = {
  whisper: Volume1,
  shout: Megaphone,
  tremble: Vibrate,
  impact: Zap,
  monologue: CloudMoon,
}

export function MessageEffectPicker({ selectedEffect, onSelect, theme }) {
  return (
    <div className="message-effect-picker inline-panel-reveal">
      <div className="message-effect-picker__heading">
        <Sparkles size={14} />
        다음 메시지 연출
      </div>
      <div className="message-effect-picker__grid">
        {MESSAGE_EFFECTS.map(effect => {
          const Icon = EFFECT_ICONS[effect.key]
          const selected = selectedEffect === effect.key
          return (
            <button
              key={effect.key}
              type="button"
              aria-pressed={selected}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onSelect(effect.key)}
              style={{
                borderColor: selected ? theme.point : theme.border,
                background: selected ? `${theme.point}22` : theme.bg,
                color: selected ? theme.point : theme.theirText,
              }}>
              <Icon size={17} />
              <span>
                <strong>{effect.label}</strong>
                <small style={{ color: theme.subText }}>{effect.description}</small>
              </span>
            </button>
          )
        })}
      </div>
      {selectedEffect && (
        <button
          type="button"
          className="message-effect-picker__clear"
          onMouseDown={event => event.preventDefault()}
          onClick={() => onSelect(null)}
          style={{ color: theme.subText }}>
          효과 없이 보내기
        </button>
      )}
    </div>
  )
}

export function MessageEffectChip({ effectKey, onClear, theme }) {
  const effect = getMessageEffect(effectKey)
  if (!effect) return null
  const Icon = EFFECT_ICONS[effect.key]
  return (
    <div
      className="composer-effect-chip"
      style={{
        borderColor: `${theme.point}88`,
        background: `color-mix(in srgb, ${theme.panel} 88%, transparent)`,
        color: theme.point,
      }}>
      <Icon size={13} />
      <span>{effect.label}</span>
      <button
        type="button"
        aria-label={`${effect.label} 효과 해제`}
        onMouseDown={event => event.preventDefault()}
        onClick={onClear}
        style={{ color: theme.subText }}>
        <X size={12} />
      </button>
    </div>
  )
}

export function MessageEffectBubble({
  effectKey,
  animateOnMount = false,
  canReplay,
  className = '',
  children,
  ...props
}) {
  const effect = getMessageEffect(effectKey)
  const [replayCount, setReplayCount] = useState(0)
  const shouldAnimate = Boolean(effect && (animateOnMount || replayCount > 0))
  const effectClassName = getMessageEffectClassName(effectKey, shouldAnimate)

  const replay = () => {
    if (!effect || canReplay?.() === false) return
    setReplayCount(count => count + 1)
  }

  const handleKeyDown = event => {
    props.onKeyDown?.(event)
    if (!effect || event.defaultPrevented) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      replay()
    }
  }

  return (
    <div
      {...props}
      key={replayCount}
      data-message-bubble
      className={[className, effectClassName].filter(Boolean).join(' ')}
      role={effect ? 'button' : props.role}
      tabIndex={effect ? 0 : props.tabIndex}
      aria-label={effect ? `${effect.label} 효과 다시 보기` : props['aria-label']}
      onClick={effect ? replay : props.onClick}
      onKeyDown={handleKeyDown}>
      {children}
    </div>
  )
}
