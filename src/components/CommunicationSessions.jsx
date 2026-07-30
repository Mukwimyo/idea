import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Phone, PhoneOff, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

function durationLabel(startedAt, endedAt, now) {
  if (!startedAt) return '00:00'
  const end = endedAt ? new Date(endedAt).getTime() : now
  const displayedSeconds = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 5000))
  return `${String(Math.floor(displayedSeconds / 60)).padStart(2, '0')}:${String(displayedSeconds % 60).padStart(2, '0')}`
}

export default function CommunicationSessions({ roomId, userId, myChars, theme, open, onClose }) {
  const [kind, setKind] = useState('call')
  const [characters, setCharacters] = useState([])
  const [senderId, setSenderId] = useState(myChars[0]?.id || '')
  const [receiverId, setReceiverId] = useState('')
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState({})
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(Date.now())
  const t = theme

  const activeSession = sessions.find(session => ['ringing', 'active'].includes(session.status))
  const history = sessions.filter(session => !['ringing', 'active'].includes(session.status))
  const characterById = useMemo(() => Object.fromEntries(characters.map(character => [character.id, character])), [characters])
  const receiverOptions = characters.filter(character => character.user_id !== userId)

  const fetchSessions = async () => {
    const { data } = await supabase.from('communication_sessions').select('*').eq('room_id', roomId).order('created_at', { ascending: false })
    setSessions(data || [])
  }

  const fetchMessages = async sessionId => {
    const { data } = await supabase.from('communication_session_messages').select('*').eq('session_id', sessionId).order('created_at')
    setMessages(current => ({ ...current, [sessionId]: data || [] }))
  }

  useEffect(() => {
    const load = async () => {
      const { data: pool } = await supabase.from('room_characters').select('character_id, characters(id, user_id, name, image_url)').eq('room_id', roomId)
      const roomCharacters = (pool || []).map(row => row.characters).filter(Boolean)
      setCharacters(roomCharacters)
      const firstReceiver = roomCharacters.find(character => character.user_id !== userId)
      setReceiverId(current => current || firstReceiver?.id || '')
      await fetchSessions()
    }
    load()

    const channel = supabase
      .channel(`communication-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_sessions', filter: `room_id=eq.${roomId}` }, fetchSessions)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_session_messages' }, payload => {
        setMessages(current => ({ ...current, [payload.new.session_id]: [...(current[payload.new.session_id] || []), payload.new] }))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [roomId, userId])

  useEffect(() => {
    sessions
      .filter(session => session.status === 'active')
      .forEach(session => {
        if (!messages[session.id]) fetchMessages(session.id)
      })
  }, [sessions])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const createSession = async () => {
    const sender = characterById[senderId]
    const receiver = characterById[receiverId]
    if (!sender || !receiver || sender.user_id === receiver.user_id) return
    await supabase.from('communication_sessions').insert({
      room_id: roomId,
      kind,
      sender_character_id: sender.id,
      receiver_character_id: receiver.id,
      sender_user_id: sender.user_id,
      receiver_user_id: receiver.user_id,
    })
  }

  const updateSession = async (session, status) => {
    const patch = { status }
    if (status === 'active') patch.started_at = new Date().toISOString()
    if (['declined', 'left', 'ended'].includes(status)) patch.ended_at = new Date().toISOString()
    await supabase.from('communication_sessions').update(patch).eq('id', session.id)
  }

  const sendMessage = async session => {
    if (!draft.trim()) return
    const characterId = session.sender_user_id === userId ? session.sender_character_id : session.receiver_character_id
    await supabase.from('communication_session_messages').insert({ session_id: session.id, user_id: userId, character_id: characterId, content: draft.trim() })
    setDraft('')
  }

  const sessionTitle = session => `${characterById[session.sender_character_id]?.name || '캐릭터'} × ${characterById[session.receiver_character_id]?.name || '캐릭터'}`
  const isReceiver = session => session.receiver_user_id === userId
  const visible = open || (activeSession?.status === 'ringing' && isReceiver(activeSession))

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: `${t.bg}f2`, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: t.panel, borderBottom: `1px solid ${t.border}` }}>
        <strong style={{ flex: 1, color: t.theirText }}>전화 · 문자</strong>
        <button onClick={onClose} aria-label="닫기" style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`, background: 'none', color: t.subText, display: 'grid', placeItems: 'center' }}>
          <X size={17} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {!activeSession && (
          <section style={{ padding: 14, borderRadius: 18, background: t.panel, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setKind('call')} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${kind === 'call' ? t.point : t.border}`, background: kind === 'call' ? `${t.point}22` : 'none', color: kind === 'call' ? t.point : t.subText }}>
                <Phone size={15} /> 전화
              </button>
              <button onClick={() => setKind('text')} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${kind === 'text' ? t.point : t.border}`, background: kind === 'text' ? `${t.point}22` : 'none', color: kind === 'text' ? t.point : t.subText }}>
                <MessageSquare size={15} /> 문자
              </button>
            </div>
            <label style={{ display: 'block', color: t.subText, fontSize: 12, marginBottom: 10 }}>
              보내는 캐릭터
              <select value={senderId} onChange={event => setSenderId(event.target.value)} style={{ width: '100%', marginTop: 5, padding: 9, borderRadius: 10, background: t.bg, color: t.inputText, border: `1px solid ${t.border}` }}>
                {myChars.map(character => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', color: t.subText, fontSize: 12 }}>
              받는 캐릭터
              <select value={receiverId} onChange={event => setReceiverId(event.target.value)} style={{ width: '100%', marginTop: 5, padding: 9, borderRadius: 10, background: t.bg, color: t.inputText, border: `1px solid ${t.border}` }}>
                {receiverOptions.map(character => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={createSession} disabled={!senderId || !receiverId} style={{ width: '100%', marginTop: 14, padding: 11, border: 0, borderRadius: 12, background: t.point, color: '#fff' }}>
              연락하기
            </button>
          </section>
        )}

        {activeSession?.status === 'ringing' && (
          <section style={{ marginTop: 32, textAlign: 'center' }}>
            <img src={characterById[activeSession.sender_character_id]?.image_url || DEFAULT_AVATAR} alt="" style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: '50%' }} />
            <div style={{ marginTop: 10, fontSize: 12, color: t.subText }}>{activeSession.kind === 'call' ? '수신 전화' : '새 문자'}</div>
            <h2 style={{ color: t.theirText }}>
              {characterById[activeSession.sender_character_id]?.name}에게 {activeSession.kind === 'call' ? '전화가' : '문자가'} 왔습니다
            </h2>
            {isReceiver(activeSession) ? (
              activeSession.kind === 'call' ? (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 72, marginTop: 28 }}>
                  <label style={{ display: 'grid', gap: 8, color: t.theirText }}>
                    <button onClick={() => updateSession(activeSession, 'active')} aria-label="받기" style={{ width: 66, height: 66, border: 0, borderRadius: '50%', background: '#26a65b', color: '#fff' }}>
                      <Phone size={27} />
                    </button>
                    받기
                  </label>
                  <label style={{ display: 'grid', gap: 8, color: t.theirText }}>
                    <button onClick={() => updateSession(activeSession, 'declined')} aria-label="거절" style={{ width: 66, height: 66, border: 0, borderRadius: '50%', background: '#e5484d', color: '#fff' }}>
                      <PhoneOff size={27} />
                    </button>
                    거절
                  </label>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
                  <button onClick={() => updateSession(activeSession, 'active')} style={{ padding: '10px 22px', border: 0, borderRadius: 12, background: t.point, color: '#fff' }}>
                    입장
                  </button>
                  <button onClick={() => updateSession(activeSession, 'left')} style={{ padding: '10px 22px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'none', color: t.subText }}>
                    나가기
                  </button>
                </div>
              )
            ) : (
              <div style={{ marginTop: 24, color: t.subText }}>응답을 기다리는 중…</div>
            )}
          </section>
        )}

        {activeSession?.status === 'active' && (
          <section style={{ borderRadius: 22, overflow: 'hidden', background: t.panel, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${t.border}`, color: t.subText, fontSize: 11 }}>
              <span>IDEA</span>
              <span>●●● 87%</span>
            </div>
            <div style={{ padding: 14, textAlign: 'center', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.subText }}>{activeSession.kind === 'call' ? `통화 중 · ${durationLabel(activeSession.started_at, null, now)}` : '문자 대화'}</div>
              <strong style={{ color: t.theirText }}>{sessionTitle(activeSession)}</strong>
            </div>
            <div style={{ minHeight: 230, padding: 14 }}>
              {(messages[activeSession.id] || []).map(message => (
                <div key={message.id} style={{ width: 'fit-content', maxWidth: '75%', margin: message.user_id === userId ? '0 0 9px auto' : '0 auto 9px 0', padding: '8px 11px', borderRadius: 12, background: message.user_id === userId ? t.myBubble : t.theirBubble, color: message.user_id === userId ? t.myText : t.theirText }}>
                  {message.content}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 7, padding: 10, borderTop: `1px solid ${t.border}` }}>
              <input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendMessage(activeSession)} placeholder="대화를 입력…" style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 10, background: t.bg, color: t.inputText, border: `1px solid ${t.border}` }} />
              <button onClick={() => sendMessage(activeSession)} aria-label="전송" style={{ width: 40, border: 0, borderRadius: 10, background: t.point, color: '#fff' }}>
                <Send size={16} />
              </button>
              <button onClick={() => updateSession(activeSession, 'ended')} aria-label="종료" style={{ width: 40, borderRadius: 10, border: `1px solid ${t.border}`, background: 'none', color: t.subText }}>
                <PhoneOff size={16} />
              </button>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
            {history.map(session => (
              <details key={session.id} style={{ padding: 12, borderRadius: 12, background: t.panel, border: `1px solid ${t.border}`, color: t.theirText }}>
                <summary>
                  {sessionTitle(session)} · {session.status === 'declined' ? '거절된 통화' : session.status === 'left' ? '입장하지 않은 문자' : `${session.kind === 'call' ? '통화' : '문자'} 종료`}
                </summary>
                <div style={{ marginTop: 8, color: t.subText, fontSize: 11 }}>{session.kind === 'call' && `통화 시간 ${durationLabel(session.started_at, session.ended_at, now)}`}</div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
