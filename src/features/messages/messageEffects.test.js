import { describe, expect, it } from 'vitest'
import {
  MESSAGE_EFFECTS,
  getMessageEffect,
  getMessageEffectClassName,
  isMessageEffectKey,
} from './messageEffects'

describe('message effects', () => {
  it('exposes only the supported effect keys', () => {
    expect(MESSAGE_EFFECTS.map(effect => effect.key)).toEqual([
      'whisper',
      'shout',
      'tremble',
      'impact',
      'monologue',
    ])
    expect(isMessageEffectKey('impact')).toBe(true)
    expect(isMessageEffectKey('arbitrary-css')).toBe(false)
  })

  it('never creates a class name from an unsupported database value', () => {
    expect(getMessageEffect('unknown')).toBeNull()
    expect(getMessageEffectClassName('unknown', true)).toBe('')
    expect(getMessageEffectClassName('whisper', true)).toBe(
      'message-effect message-effect--whisper message-effect--playing'
    )
  })
})
