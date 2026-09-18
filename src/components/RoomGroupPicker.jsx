import { useState } from 'react'
import { FolderPlus, X } from 'lucide-react'

export default function RoomGroupPicker({ groups, value, onChange, onCreate, theme, disabled = false }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const group = await onCreate(name.trim())
    setSaving(false)
    if (!group) return
    onChange(group.id)
    setName('')
    setCreating(false)
  }

  return (
    <div style={{ marginTop: 11 }}>
      <div style={{ marginBottom: 7, color: theme.subText, fontSize: 12 }}>방 그룹</div>
      {creating ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && create()}
            placeholder="예) 우주모험"
            maxLength={40}
            style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: `1px solid ${theme.border}`, borderRadius: 8, outline: 'none', background: theme.bg, color: theme.inputText, fontSize: 12 }}
          />
          <button type="button" onClick={create} disabled={!name.trim() || saving} style={{ padding: '0 12px', border: 0, borderRadius: 8, background: theme.point, color: '#fff', fontSize: 11 }}>추가</button>
          <button type="button" aria-label="그룹 만들기 취소" onClick={() => { setCreating(false); setName('') }} style={{ width: 36, border: 0, borderRadius: 8, background: theme.bg, color: theme.subText }}><X size={14} /></button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={value || ''}
            onChange={event => onChange(event.target.value || null)}
            disabled={disabled}
            style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: `1px solid ${theme.border}`, borderRadius: 8, outline: 'none', background: theme.bg, color: theme.inputText, fontSize: 12 }}>
            <option value="">미분류</option>
            {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <button type="button" onClick={() => setCreating(true)} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 11px', border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.bg, color: theme.subText, fontSize: 11 }}><FolderPlus size={14} />새 그룹</button>
        </div>
      )}
    </div>
  )
}
