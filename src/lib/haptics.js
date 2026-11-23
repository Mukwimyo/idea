const IMPACT_HAPTICS_KEY = 'idea-impact-haptics'

export function isImpactHapticsSupported() {
  return typeof navigator !== 'undefined'
    && typeof navigator.vibrate === 'function'
    && /Android/.test(navigator.userAgent)
}

export function getImpactHapticsEnabled() {
  try {
    return localStorage.getItem(IMPACT_HAPTICS_KEY) === '1'
  } catch {
    return false
  }
}

export function setImpactHapticsEnabled(enabled) {
  try {
    localStorage.setItem(IMPACT_HAPTICS_KEY, enabled ? '1' : '0')
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export function vibrateImpact() {
  try {
    if (isImpactHapticsSupported() && getImpactHapticsEnabled()) {
      navigator.vibrate([24, 36, 48])
    }
  } catch {
    // Vibration is optional and should not interrupt the effect.
  }
}
