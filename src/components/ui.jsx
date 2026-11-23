import { forwardRef, useEffect, useId, useRef } from 'react'

export const Button = forwardRef(function Button(
  { variant = 'primary', size, block = false, type = 'button', className, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={[
        'ui-btn',
        `ui-btn--${variant}`,
        size === 'sm' && 'ui-btn--sm',
        block && 'ui-btn--block',
        className,
      ].filter(Boolean).join(' ')}
    />
  )
})

export function IconButton({ active = false, color, borderColor, pointColor, label, title, className, style, ...props }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={title || label}
      className={['ui-icon-btn', active && 'ui-icon-btn--active', className].filter(Boolean).join(' ')}
      style={{
        '--ui-icon-btn-color': color,
        '--ui-icon-btn-border': borderColor,
        '--ui-icon-btn-point': pointColor,
        '--ui-icon-btn-active-bg': pointColor ? `color-mix(in srgb, ${pointColor} 15%, transparent)` : undefined,
        ...style,
      }}
    />
  )
}

export const TextInput = forwardRef(function TextInput({ className, ...props }, ref) {
  return <input {...props} ref={ref} className={['ui-input', className].filter(Boolean).join(' ')} />
})

export const TextArea = forwardRef(function TextArea({ className, ...props }, ref) {
  return <textarea {...props} ref={ref} className={['ui-input', className].filter(Boolean).join(' ')} />
})

export function Card({ as: Component = 'div', interactive = false, className, ...props }) {
  return (
    <Component
      {...props}
      className={['ui-card', interactive && 'ui-card--interactive', className].filter(Boolean).join(' ')}
    />
  )
}

export { Card as Surface }

export function Skeleton({ className }) {
  return (
    <div
      className={['ui-skeleton', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  )
}

export function Toggle({ checked, onChange, label, disabled, className, onClick, ...props }) {
  return (
    <button
      type="button"
      {...props}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={['ui-switch', className].filter(Boolean).join(' ')}
      onClick={event => {
        onClick?.(event)
        onChange?.(!checked)
      }}>
      <span className="ui-switch__track" aria-hidden="true" />
    </button>
  )
}

export function Dialog({
  open,
  title,
  description,
  onCancel,
  closeOnBackdrop = true,
  initialFocusRef,
  role = 'dialog',
  className,
  children,
  ...props
}) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const timer = window.setTimeout(() => {
      const focusTarget = initialFocusRef?.current ?? panelRef.current
      focusTarget?.focus()
    }, 0)
    const handleKeyDown = event => {
      if (event.key === 'Escape') onCancel?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [open, initialFocusRef, onCancel])

  if (!open) return null

  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (closeOnBackdrop && event.target === event.currentTarget) onCancel?.()
      }}>
      <section
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        {...props}
        ref={panelRef}
        role={role}
        className={['ui-dialog', className].filter(Boolean).join(' ')}>
        {title && <h2 id={titleId} className="ui-dialog-title">{title}</h2>}
        {description && <p id={descriptionId} className="ui-dialog-description">{description}</p>}
        {children}
      </section>
    </div>
  )
}
