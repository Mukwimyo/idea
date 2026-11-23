import { IconButton } from './ui'

export default function QuickToolPicker({ tools, activeId, onSelect }) {
  if (tools.length < 2) return null

  return (
    <div
      className="quick-tool-picker"
      role="toolbar"
      aria-label="즐겨찾기한 빠른 도구">
      {tools.map(tool => {
        const ToolIcon = tool.icon
        const selected = tool.id === activeId
        return (
          <IconButton
            key={tool.id}
            type="button"
            label={`${tool.label} 선택`}
            aria-pressed={selected}
            title={tool.label}
            onMouseDown={event => event.preventDefault()}
            onClick={() => onSelect(tool.id)}>
            <ToolIcon size={17} />
          </IconButton>
        )
      })}
    </div>
  )
}

