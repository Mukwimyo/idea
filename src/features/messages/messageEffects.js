export const MESSAGE_EFFECTS = Object.freeze([
  { key: 'whisper', label: '속삭임', description: '작고 흐리게 스며들기' },
  { key: 'shout', label: '외침', description: '크고 굵게 튀어나오기' },
  { key: 'tremble', label: '떨림', description: '조금 길게 떨리는 긴장감' },
  { key: 'impact', label: '충격', description: '화면까지 흔드는 충격' },
  { key: 'monologue', label: '독백', description: '천천히 떠오르는 내면의 말' },
])

export const MESSAGE_ENTRANCE_EFFECT_DELAY_MS = 260

const MESSAGE_EFFECT_BY_KEY = new Map(
  MESSAGE_EFFECTS.map(effect => [effect.key, effect])
)

export const isMessageEffectKey = value =>
  typeof value === 'string' && MESSAGE_EFFECT_BY_KEY.has(value)

export const getMessageEffect = value =>
  MESSAGE_EFFECT_BY_KEY.get(value) || null

export const getMessageEffectClassName = (value, animate = false) => {
  if (!isMessageEffectKey(value)) return ''
  return [
    'message-effect',
    `message-effect--${value}`,
    animate ? 'message-effect--playing' : '',
  ].filter(Boolean).join(' ')
}
