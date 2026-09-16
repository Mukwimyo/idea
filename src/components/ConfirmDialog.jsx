import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ open, title, description, confirmLabel = '확인', cancelLabel = '취소', danger = false, theme, onConfirm, onCancel }) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 0)
    const handleKeyDown = event => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
      <section className="ui-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" style={{ background: theme.panel, borderColor: theme.border }}>
        <h2 id="confirm-dialog-title" style={{ color: theme.theirText }}>{title}</h2>
        {description && <p id="confirm-dialog-description" style={{ color: theme.subText }}>{description}</p>}
        <div className="ui-dialog-actions">
          <button onClick={onCancel} style={{ color: theme.theirText, borderColor: theme.border, background: 'transparent' }}>{cancelLabel}</button>
          <button ref={confirmRef} onClick={onConfirm} style={{ color: '#fff', borderColor: 'transparent', background: danger ? '#d84f57' : theme.point }}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
