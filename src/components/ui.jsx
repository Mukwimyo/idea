export function IconButton({ active = false, color, borderColor, pointColor, label, title, onClick, children, style, ...props }) {
  return (
    <button
      {...props}
      onClick={onClick}
      aria-label={label}
      title={title || label}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        border: `1px solid ${active ? pointColor : borderColor}`,
        borderRadius: 10,
        color,
        background: active ? `${pointColor}22` : 'transparent',
        cursor: 'pointer',
        ...style,
      }}>
      {children}
    </button>
  )
}

export function Surface({ as: Component = 'div', color, borderColor, children, style, ...props }) {
  return (
    <Component
      {...props}
      style={{
        background: color,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--ui-radius-md)',
        ...style,
      }}>
      {children}
    </Component>
  )
}
