import { useState } from 'react'
import { Button, Card, TextInput } from './ui'

export default function RoomGroupCreatePanel({ onCreate, onClose }) {
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
    <Card className="inline-panel-reveal room-list-inline-panel room-group-create-panel">
      <div className="room-list-field-label">새 방 그룹</div>
      <div className="room-list-group-create-fields">
        <TextInput
          className="room-list-input"
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && create()}
          placeholder="예) 우주모험"
          maxLength={40}
          aria-label="새 방 그룹 이름"
        />
        <Button onClick={create} disabled={!name.trim() || saving}>
          {saving ? '저장 중' : '추가'}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </Button>
      </div>
    </Card>
  )
}
