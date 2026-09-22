export default function QuickToolPicker({ tools, activeId, theme, onSelect }) {
  if (tools.length < 2) return null

  return (
    <div
      className="quick-tool-picker"
      role="toolbar"
      aria-label="즐겨찾기한 빠른 도구"
      style={{
        '--quick-tool-panel': `color-mix(in srgb, ${theme.panel} 94%, transparent)`,
        '--quick-tool-border': theme.border,
        '--quick-tool-point': theme.point,
        '--quick-tool-text': theme.subText,
      }}>
      {tools.map(tool => {
        const ToolIcon = tool.icon
        const selected = tool.id === activeId
        return (
          <button
            key={tool.id}
            type="button"
            aria-label={`${tool.label} 선택`}
            aria-pressed={selected}
            title={tool.label}
            onMouseDown={event => event.preventDefault()}
            onClick={() => onSelect(tool.id)}>
            <ToolIcon size={17} />
          </button>
        )
      })}
    </div>
  )
}

