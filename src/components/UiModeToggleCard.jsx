import { Sparkles } from 'lucide-react'
import { UI_MODES } from '../lib/uiMode'

export default function UiModeToggleCard({ mode, onChange, theme }) {
  const enabled = mode === UI_MODES.MODERN

  return (
    <section className="ui-mode-card" style={{ '--ui-mode-panel': theme.panel, '--ui-mode-border': theme.border, '--ui-mode-point': theme.point, '--ui-mode-text': theme.theirText, '--ui-mode-subtext': theme.subText }}>
      <div className="ui-mode-card__copy">
        <span className="ui-mode-card__icon" aria-hidden="true"><Sparkles size={16} /></span>
        <div>
          <strong>새 디자인</strong>
          <span>부드러운 레이어와 간결한 외곽선</span>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="새 디자인 사용"
        className="ui-mode-switch"
        onClick={() => onChange(enabled ? UI_MODES.CLASSIC : UI_MODES.MODERN)}>
        <span />
      </button>
    </section>
  )
}
