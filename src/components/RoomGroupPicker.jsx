export default function RoomGroupPicker({ groups, value, onChange, theme, disabled = false }) {
  return (
    <div style={{ marginTop: 11 }}>
      <div style={{ marginBottom: 7, color: theme.subText, fontSize: 12 }}>방 그룹</div>
      <select
        value={value || ''}
        onChange={event => onChange(event.target.value || null)}
        disabled={disabled}
        style={{ width: '100%', minWidth: 0, padding: '9px 11px', border: `1px solid ${theme.border}`, borderRadius: 8, outline: 'none', background: theme.bg, color: theme.inputText, fontSize: 12 }}>
        <option value="">미분류</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </div>
  )
}
