export const MESSAGE_EFFECTS = Object.freeze([
  { key: 'whisper', label: '속삭임', description: '조용히 스며드는 등장' },
  { key: 'shout', label: '외침', description: '크고 선명하게 튀어나오기' },
  { key: 'tremble', label: '떨림', description: '짧게 흔들리는 긴장감' },
  { key: 'impact', label: '충격', description: '강하게 부딪히듯 등장' },
  { key: 'monologue', label: '독백', description: '천천히 떠오르는 내면의 말' },
])

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
