import { useCallback, useEffect, useRef } from 'react'

const IMPACT_KEYFRAMES = [
  { transform: 'translate3d(0, 0, 0)' },
  { transform: 'translate3d(-5px, 1px, 0)' },
  { transform: 'translate3d(4px, -1px, 0)' },
  { transform: 'translate3d(-3px, 0, 0)' },
  { transform: 'translate3d(2px, 0, 0)' },
  { transform: 'translate3d(0, 0, 0)' },
]

export default function useMessageStageEffects(stageRef) {
  const impactAnimationRef = useRef(null)

  useEffect(() => () => impactAnimationRef.current?.cancel(), [])

  return useCallback(effectKey => {
    if (effectKey !== 'impact') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const stage = stageRef.current
    if (!stage?.animate) return

    impactAnimationRef.current?.cancel()
    impactAnimationRef.current = stage.animate(IMPACT_KEYFRAMES, {
      duration: 380,
      easing: 'ease-out',
    })
  }, [stageRef])
}
