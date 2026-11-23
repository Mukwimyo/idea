import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card } from './ui'

export default function CommunicationRecord({ message, onOpenSession }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loadError, setLoadError] = useState('')
  let record
  try {
    record = JSON.parse(message.content)
  } catch {
    record = { title: '종료된 대화', kind: 'text' }
  }

  useEffect(() => {
    if (!open || !record.sessionId) return
    supabase
      .from('communication_session_messages')
      .select('id, user_id, content, created_at, characters(name)')
      .eq('session_id', record.sessionId)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          setLoadError('저장된 대화를 불러오지 못했습니다. 다시 접었다 펼쳐주세요.')
          return
        }
        setLoadError('')
        setItems(data || [])
      })
  }, [open, record.sessionId])

  return (
    <Card className="communication-record">
      <Button variant="ghost" block className="communication-record__toggle"
        onClick={() => {
          if (record.status === 'ringing' || record.status === 'active') {
            onOpenSession?.()
            return
          }
          setOpen(value => !value)
        }}
        aria-expanded={open}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {record.kind === 'call' ? <Phone size={15} /> : <MessageSquare size={15} />}
        <span className="communication-record__summary">
          <span>{record.title}</span>
          <small>{record.statusLabel}{record.duration ? ` · ${record.duration}` : ''}{record.status === 'ringing' || record.status === 'active' ? ' · 눌러서 열기' : ''}</small>
        </span>
      </Button>
      {open && (
        <div className="communication-record__items">
          {loadError
            ? <div role="alert" className="room-panel-error">{loadError}</div>
            : items.length === 0 && <div className="room-panel-caption">저장된 대화 내용이 없습니다.</div>}
          {items.map(item => (
            <div key={item.id} className="communication-record__item">
              <span>{item.characters?.name || '캐릭터'}</span>
              {item.content}
            </div>
          ))}
          <div className="room-panel-caption">종료된 대화에는 새 메시지를 입력할 수 없습니다.</div>
        </div>
      )}
    </Card>
  )
}
