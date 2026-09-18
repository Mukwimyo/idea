import { useState } from 'react'

export default function RoomGroupCreatePanel({ onCreate, onClose, theme }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || saving) return

    setSaving(true)
    const group = await onCreate(trimmedName)
    setSaving(false)
    if (!group) return

    setName('')
    onClose()
  }

  return (
    <div
      className="inline-panel-reveal"
      style={{
        padding: 14,
        marginBottom: 12,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        background: theme.panel,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }}>
      <div style={{ marginBottom: 8, color: theme.subText, fontSize: 12 }}>새 방 그룹</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && create()}
          placeholder="예) 우주모험"
          maxLength={40}
          aria-label="새 방 그룹 이름"
          style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: `1px solid ${theme.border}`, borderRadius: 8, outline: 'none', background: theme.bg, color: theme.inputText, fontSize: 12 }}
        />
        <button type="button" onClick={create} disabled={!name.trim() || saving} style={{ padding: '0 13px', border: 0, borderRadius: 8, background: theme.point, color: '#fff', fontSize: 11 }}>
          {saving ? '저장 중' : '추가'}
        </button>
        <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.bg, color: theme.subText, fontSize: 11 }}>
          취소
        </button>
      </div>
    </div>
  )
}
