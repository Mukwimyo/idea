import { useCallback, useEffect, useRef, useState } from 'react'

export default function useConfirmDialog() {
  const [confirmation, setConfirmation] = useState(null)
  const resolveRef = useRef(null)

  const confirm = useCallback(options => new Promise(resolve => {
    resolveRef.current?.(false)
    resolveRef.current = resolve
    setConfirmation(options)
  }), [])

  const closeConfirmation = useCallback(result => {
    resolveRef.current?.(result)
    resolveRef.current = null
    setConfirmation(null)
  }, [])

  useEffect(() => () => resolveRef.current?.(false), [])

  return { confirmation, confirm, closeConfirmation }
}
