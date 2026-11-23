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
      'shout',
      'impact',
    ])
    expect(isMessageEffectKey('impact')).toBe(true)
  })

  it.each(['whisper', 'tremble', 'monologue', 'arbitrary-css'])(
    'rejects unsupported database value %s without creating a class name',
    effectKey => {
      expect(isMessageEffectKey(effectKey)).toBe(false)
      expect(getMessageEffect(effectKey)).toBeNull()
      expect(getMessageEffectClassName(effectKey, true)).toBe('')
    }
  )
})
