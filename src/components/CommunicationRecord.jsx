import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function CommunicationRecord({ message, theme, onOpenSession }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loadError, setLoadError] = useState('')
  const t = theme
  let record
  try {
    record = JSON.parse(message.content)
  } catch {
    record = { title: '종료된 대화', kind: 'text' }
  }

  useEffect(() => {
    if (!open || !record.sessionId) return
    setLoadError('')
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
        setItems(data || [])
      })
  }, [open, record.sessionId])

  return (
    <div style={{ width: 'calc(100% - 20px)', margin: '4px auto', padding: 11, borderRadius: 13, border: `1px solid ${t.border}`, background: t.panel }}>
      <button
        onClick={() => {
          if (record.status === 'ringing' || record.status === 'active') {
            onOpenSession?.()
            return
          }
          setOpen(value => !value)
        }}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: 0, border: 0, background: 'none', color: t.theirText, textAlign: 'left' }}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {record.kind === 'call' ? <Phone size={15} /> : <MessageSquare size={15} />}
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12 }}>{record.title}</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: t.subText }}>{record.statusLabel}{record.duration ? ` · ${record.duration}` : ''}{record.status === 'ringing' || record.status === 'active' ? ' · 눌러서 열기' : ''}</span>
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`, display: 'grid', gap: 7 }}>
          {loadError
            ? <div role="alert" style={{ color: '#ef7777', fontSize: 11 }}>{loadError}</div>
            : items.length === 0 && <div style={{ color: t.subText, fontSize: 11 }}>저장된 대화 내용이 없습니다.</div>}
          {items.map(item => (
            <div key={item.id} style={{ color: t.theirText, fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ marginRight: 7, color: t.subText }}>{item.characters?.name || '캐릭터'}</span>
              {item.content}
            </div>
          ))}
          <div style={{ color: t.subText, fontSize: 10 }}>종료된 대화에는 새 메시지를 입력할 수 없습니다.</div>
        </div>
      )}
    </div>
  )
}
