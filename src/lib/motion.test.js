import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion } from './motion'

describe('prefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([true, false])('returns the media query match (%s)', matches => {
    const matchMedia = vi.fn(() => ({ matches }))
    vi.stubGlobal('matchMedia', matchMedia)

    expect(prefersReducedMotion()).toBe(matches)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('returns false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(prefersReducedMotion()).toBe(false)
  })

  it('returns false without a browser window', () => {
    vi.stubGlobal('window', undefined)

    expect(prefersReducedMotion()).toBe(false)
  })
})
