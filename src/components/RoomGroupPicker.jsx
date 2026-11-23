export default function RoomGroupPicker({ groups, value, onChange, disabled = false }) {
  return (
    <div className="room-group-picker">
      <div className="room-list-field-label">방 그룹</div>
      <select
        aria-label="방 그룹"
        className="ui-input room-list-input"
        value={value || ''}
        onChange={event => onChange(event.target.value || null)}
        disabled={disabled}>
        <option value="">미분류</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </div>
  )
}
