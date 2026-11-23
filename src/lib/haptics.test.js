import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getImpactHapticsEnabled, isImpactHapticsSupported, setImpactHapticsEnabled, vibrateImpact } from './haptics'

describe('impact haptics', () => {
  beforeEach(() => {
    const storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('defaults to off even when vibration is supported', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { userAgent: 'Android', vibrate })

    expect(getImpactHapticsEnabled()).toBe(false)
    vibrateImpact()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('stores and reads both values', () => {
    setImpactHapticsEnabled(true)
    expect(localStorage.getItem('idea-impact-haptics')).toBe('1')
    expect(getImpactHapticsEnabled()).toBe(true)

    setImpactHapticsEnabled(false)
    expect(localStorage.getItem('idea-impact-haptics')).toBe('0')
    expect(getImpactHapticsEnabled()).toBe(false)
  })

  it('does not vibrate on a non-Android device', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { userAgent: 'iPhone', vibrate })
    setImpactHapticsEnabled(true)

    expect(isImpactHapticsSupported()).toBe(false)
    vibrateImpact()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it.each([
    ['an Android device without vibrate', { userAgent: 'Android' }],
    ['an environment without navigator', undefined],
  ])('skips vibration in %s', (_description, nav) => {
    vi.stubGlobal('navigator', nav)
    const getItem = vi.spyOn(localStorage, 'getItem')
    setImpactHapticsEnabled(true)

    expect(isImpactHapticsSupported()).toBe(false)
    vibrateImpact()
    expect(getItem).not.toHaveBeenCalled()
  })

  it('plays the impact pattern once on supported devices when enabled', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15)', vibrate })
    setImpactHapticsEnabled(true)

    expect(isImpactHapticsSupported()).toBe(true)
    vibrateImpact()
    expect(vibrate).toHaveBeenCalledExactlyOnceWith([24, 36, 48])
  })

  it('treats a storage access error as disabled and ignores write errors', () => {
    const inaccessibleStorage = () => {
      throw new Error('Storage unavailable')
    }
    vi.stubGlobal('localStorage', { getItem: inaccessibleStorage, setItem: inaccessibleStorage })

    expect(getImpactHapticsEnabled()).toBe(false)
    expect(() => setImpactHapticsEnabled(true)).not.toThrow()
  })

  it('ignores vibration errors', () => {
    const vibrate = vi.fn(() => {
      throw new Error('Vibration unavailable')
    })
    vi.stubGlobal('navigator', { userAgent: 'Android', vibrate })
    setImpactHapticsEnabled(true)

    expect(() => vibrateImpact()).not.toThrow()
    expect(vibrate).toHaveBeenCalledOnce()
  })
})
