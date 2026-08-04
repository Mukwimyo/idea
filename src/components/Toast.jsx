import { useEffect, useRef, useState } from 'react'

export function useToast() {
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

export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        zIndex: 500,
        left: '50%',
        bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 32px)',
        padding: '9px 14px',
        borderRadius: 999,
        color: '#fff',
        background: toast.type === 'error' ? 'rgba(190,55,62,0.94)' : 'rgba(35,35,38,0.92)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontSize: 12,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
        animation: 'toast-enter 180ms ease-out',
      }}>
      {toast.message}
    </div>
  )
}
