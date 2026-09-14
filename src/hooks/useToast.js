import { useEffect, useRef, useState } from 'react'

export default function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const showToast = (message, type = 'success') => {
    window.clearTimeout(timerRef.current)
    setToast({ message, type, key: Date.now() })
    timerRef.current = window.setTimeout(() => setToast(null), 1800)
  }

  return { toast, showToast }
}
