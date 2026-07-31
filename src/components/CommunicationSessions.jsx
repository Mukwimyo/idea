import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [characterLoadError, setCharacterLoadError] = useState('')
  const [hiddenSessionId, setHiddenSessionId] = useState(null)
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight)
  const [viewportOffsetTop, setViewportOffsetTop] = useState(() => window.visualViewport?.offsetTop || 0)
  const messageInputRef = useRef(null)
  const t = theme

  const activeSession = sessions.find(session => ['ringing', 'active'].includes(session.status))
  const characterById = useMemo(() => Object.fromEntries(characters.map(character => [character.id, character])), [characters])
  const receiverOptions = characters.filter(character => character.user_id !== userId)
  const effectiveSenderId = myChars.some(character => character.id === senderId) ? senderId : myChars[0]?.id || ''
  const selectedSender = myChars.find(character => character.id === effectiveSenderId)
  const selectedReceiver = receiverOptions.find(character => character.id === receiverId)

  const fetchSessions = async () => {
    const { data } = await supabase.from('communication_sessions').select('*').eq('room_id', roomId).in('status', ['ringing', 'active']).order('created_at', { ascending: false })
    setSessions(data || [])
  }

  const fetchMessages = async sessionId => {
    const { data } = await supabase.from('communication_session_messages').select('*').eq('session_id', sessionId).order('created_at')
    setMessages(current => ({ ...current, [sessionId]: data || [] }))
  }

  useEffect(() => {
    const load = async () => {
      setCharacterLoadError('')
      const [{ data: members, error: memberError }, { data: pool, error: poolError }] = await Promise.all([
        supabase.from('room_members').select('user_id').eq('room_id', roomId),
        supabase.from('room_characters').select('character_id, user_id, sort_order').eq('room_id', roomId).order('sort_order'),
      ])
      const memberIds = [
        ...new Set([
          userId,
          ...(members || []).map(member => member.user_id),
          ...(pool || []).map(row => row.user_id),
        ]),
      ]
      const { data: memberCharacters, error: characterError } = await supabase
        .from('characters')
        .select('id, user_id, name, image_url, sort_order')
        .in('user_id', memberIds)
        .eq('is_archived', false)
        .order('sort_order')

      const poolIds = new Set((pool || []).map(row => row.character_id))
      const pooledCharacters = (memberCharacters || []).filter(character => poolIds.has(character.id))
      const otherPooledCharacters = pooledCharacters.filter(character => character.user_id !== userId)
      const otherMemberCharacters = (memberCharacters || []).filter(character => character.user_id !== userId)
      const roomCharacters = [
        ...myChars,
        ...(otherPooledCharacters.length > 0 ? otherPooledCharacters : otherMemberCharacters),
      ].filter((character, index, list) => list.findIndex(item => item.id === character.id) === index)

      setCharacters(roomCharacters)
      const firstReceiver = roomCharacters.find(character => character.user_id !== userId)
      setReceiverId(current => {
        const stillAvailable = roomCharacters.some(character => character.id === current && character.user_id !== userId)
        return stillAvailable ? current : firstReceiver?.id || ''
      })
      if (memberError || poolError || characterError) {
        setCharacterLoadError('상대 캐릭터 정보를 불러오지 못했습니다. Supabase 마이그레이션과 권한 설정을 확인해주세요.')
      } else if (!firstReceiver) {
        setCharacterLoadError('이 방에서 상대방이 사용할 캐릭터가 아직 설정되지 않았습니다.')
      }
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
  }, [roomId, userId, myChars])

  useEffect(() => {
    sessions.filter(session => session.status === 'active').forEach(session => {
      if (!messages[session.id]) fetchMessages(session.id)
    })
  }, [sessions])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined
    const syncViewport = () => {
      setViewportHeight(viewport.height)
      setViewportOffsetTop(viewport.offsetTop)
    }
    syncViewport()
    viewport.addEventListener('resize', syncViewport)
    viewport.addEventListener('scroll', syncViewport)
    return () => {
      viewport.removeEventListener('resize', syncViewport)
      viewport.removeEventListener('scroll', syncViewport)
    }
  }, [])

  const createSession = async () => {
    const sender = characterById[effectiveSenderId] || myChars.find(character => character.id === effectiveSenderId)
    const receiver = characterById[receiverId]
    if (!sender || !receiver || sender.user_id === receiver.user_id) return
    const { data: created, error } = await supabase.from('communication_sessions').insert({
      room_id: roomId,
      kind,
      sender_character_id: sender.id,
      receiver_character_id: receiver.id,
      sender_user_id: sender.user_id,
      receiver_user_id: receiver.user_id,
    }).select().single()
    if (error || !created) return

    const { data: recordMessage } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      character_id: null,
      type: 'communication',
      content: JSON.stringify({
        sessionId: created.id,
        kind,
        status: 'ringing',
        title: `${sender.name} → ${receiver.name}`,
        statusLabel: kind === 'call' ? '음성 통화' : '문자',
      }),
    }).select('id').single()

    if (recordMessage) {
      await supabase.from('communication_sessions').update({ record_message_id: recordMessage.id }).eq('id', created.id)
    }
  }

  const updateSession = async (session, status) => {
    const patch = { status }
    if (status === 'active') patch.started_at = new Date().toISOString()
    if (['declined', 'left', 'ended'].includes(status)) patch.ended_at = new Date().toISOString()
    const { data: updated, error } = await supabase.from('communication_sessions').update(patch).eq('id', session.id).select().single()
    if (error || !updated) return
    const senderName = characterById[session.sender_character_id]?.name || '캐릭터'
    const receiverName = characterById[session.receiver_character_id]?.name || '캐릭터'
    const isTerminal = ['declined', 'left', 'ended'].includes(status)
    const statusLabel =
      status === 'active'
        ? session.kind === 'call' ? '음성 통화 중' : '문자 대화 중'
        : status === 'declined'
          ? '거절된 통화'
          : status === 'left'
            ? '입장하지 않은 문자'
            : `${session.kind === 'call' ? '통화' : '문자'} 종료`
    const duration = session.kind === 'call' ? durationLabel(updated.started_at, updated.ended_at, Date.now()) : ''
    const recordContent = JSON.stringify({
      sessionId: session.id,
      kind: session.kind,
      status,
      title: isTerminal ? `${senderName} × ${receiverName}` : `${senderName} → ${receiverName}`,
      statusLabel,
      duration: isTerminal ? duration : '',
    })
    if (updated.record_message_id) {
      await supabase.from('messages').update({ content: recordContent }).eq('id', updated.record_message_id)
    } else {
      const { data: recordMessage } = await supabase.from('messages').insert({
        room_id: roomId,
        user_id: userId,
        character_id: null,
        type: 'communication',
        content: recordContent,
      }).select('id').single()
      if (recordMessage) await supabase.from('communication_sessions').update({ record_message_id: recordMessage.id }).eq('id', session.id)
    }
  }

  const sendMessage = async session => {
    if (!draft.trim()) return
    const characterId = session.sender_user_id === userId ? session.sender_character_id : session.receiver_character_id
    await supabase.from('communication_session_messages').insert({ session_id: session.id, user_id: userId, character_id: characterId, content: draft.trim() })
    setDraft('')
    window.requestAnimationFrame(() => messageInputRef.current?.focus({ preventScroll: true }))
  }

  const sessionTitle = session => `${characterById[session.sender_character_id]?.name || '캐릭터'} × ${characterById[session.receiver_character_id]?.name || '캐릭터'}`
  const isReceiver = session => session.receiver_user_id === userId
  const counterpartCharacter = session => characterById[session.sender_user_id === userId ? session.receiver_character_id : session.sender_character_id]
  const autoVisible =
    activeSession &&
    hiddenSessionId !== activeSession.id &&
    (activeSession.status === 'active' || (activeSession.status === 'ringing' && isReceiver(activeSession)))
  const visible = open || autoVisible

  useEffect(() => {
    if (!visible) return
    const focusedElement = document.activeElement
    if (focusedElement instanceof HTMLElement) focusedElement.blur()
  }, [visible])

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', top: viewportOffsetTop, left: 0, right: 0, width: '100%', height: viewportHeight, zIndex: 120, overflow: 'hidden', background: `${t.bg}f2`, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: t.panel, borderBottom: `1px solid ${t.border}` }}>
        <strong style={{ flex: 1, color: t.theirText }}>전화 · 문자</strong>
        <button
          onClick={() => {
            if (activeSession) setHiddenSessionId(activeSession.id)
            onClose()
          }}
          aria-label="본 채팅방으로 돌아가기"
          title="본 채팅방으로 돌아가기"
          style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${t.border}`, background: 'none', color: t.subText, display: 'grid', placeItems: 'center' }}>
          <X size={17} />
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column' }}>
        {!activeSession && (
          <section style={{ padding: 14, borderRadius: 18, background: t.panel, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setKind('call')} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${kind === 'call' ? t.point : t.border}`, background: kind === 'call' ? `${t.point}22` : 'none', color: kind === 'call' ? t.point : t.subText }}><Phone size={15} /> 전화</button>
              <button onClick={() => setKind('text')} style={{ flex: 1, padding: 9, borderRadius: 12, border: `1px solid ${kind === 'text' ? t.point : t.border}`, background: kind === 'text' ? `${t.point}22` : 'none', color: kind === 'text' ? t.point : t.subText }}><MessageSquare size={15} /> 문자</button>
            </div>
            <label style={{ display: 'block', color: t.subText, fontSize: 12, marginBottom: 10 }}>발신인
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, padding: '5px 8px', borderRadius: 10, background: t.bg, border: `1px solid ${t.border}` }}>
                <img src={selectedSender?.image_url || DEFAULT_AVATAR} alt="" style={{ width: 36, height: 36, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
                <select value={effectiveSenderId} onChange={event => setSenderId(event.target.value)} style={{ flex: 1, minWidth: 0, padding: 4, border: 0, outline: 'none', background: t.bg, color: t.inputText }}>
                  {myChars.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
                </select>
              </span>
            </label>
            <label style={{ display: 'block', color: t.subText, fontSize: 12 }}>수신인
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, padding: '5px 8px', borderRadius: 10, background: t.bg, border: `1px solid ${t.border}` }}>
                <img src={selectedReceiver?.image_url || DEFAULT_AVATAR} alt="" style={{ width: 36, height: 36, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
                <select value={receiverId} onChange={event => setReceiverId(event.target.value)} style={{ flex: 1, minWidth: 0, padding: 4, border: 0, outline: 'none', background: t.bg, color: t.inputText }}>
                  {receiverOptions.length === 0 && <option value="">선택 가능한 상대 캐릭터 없음</option>}
                  {receiverOptions.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
                </select>
              </span>
            </label>
            {characterLoadError && <div role="status" style={{ marginTop: 8, color: t.subText, fontSize: 11, lineHeight: 1.5 }}>{characterLoadError}</div>}
            <button onClick={createSession} disabled={!effectiveSenderId || !receiverId} style={{ width: '100%', marginTop: 14, padding: 11, border: 0, borderRadius: 12, background: t.point, color: '#fff', opacity: !effectiveSenderId || !receiverId ? 0.45 : 1 }}>연락하기</button>
          </section>
        )}

        {activeSession?.status === 'ringing' && (
          <section style={{ flex: 1, minHeight: 0, paddingTop: 32, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <img src={counterpartCharacter(activeSession)?.image_url || DEFAULT_AVATAR} alt="" style={{ width: 91, height: 91, objectFit: 'cover', borderRadius: 24 }} />
            <div style={{ marginTop: 10, fontSize: 12, color: t.subText }}>{activeSession.kind === 'call' ? '수신 전화' : '새 문자'}</div>
            <h2 style={{ color: t.theirText }}>{isReceiver(activeSession) ? `${counterpartCharacter(activeSession)?.name || '상대방'}에게 ${activeSession.kind === 'call' ? '전화가' : '문자가'} 왔습니다` : `${counterpartCharacter(activeSession)?.name || '상대방'}의 응답을 기다리는 중…`}</h2>
            {isReceiver(activeSession) ? activeSession.kind === 'call' ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 72, marginTop: 'auto', paddingTop: 28, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
                <label style={{ display: 'grid', gap: 8, color: t.theirText }}><button onClick={() => updateSession(activeSession, 'active')} aria-label="받기" style={{ width: 66, height: 66, border: 0, borderRadius: '50%', background: '#26a65b', color: '#fff' }}><Phone size={27} /></button>받기</label>
                <label style={{ display: 'grid', gap: 8, color: t.theirText }}><button onClick={() => updateSession(activeSession, 'declined')} aria-label="거절" style={{ width: 66, height: 66, border: 0, borderRadius: '50%', background: '#e5484d', color: '#fff' }}><PhoneOff size={27} /></button>거절</label>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 'auto', paddingTop: 24, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
                <button onClick={() => updateSession(activeSession, 'active')} style={{ padding: '10px 22px', border: 0, borderRadius: 12, background: t.point, color: '#fff' }}>입장</button>
                <button onClick={() => updateSession(activeSession, 'left')} style={{ padding: '10px 22px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'none', color: t.subText }}>나가기</button>
              </div>
            ) : <div style={{ marginTop: 24, color: t.subText }}>{counterpartCharacter(activeSession)?.name || '상대방'}의 응답을 기다리는 중…</div>}
          </section>
        )}

        {activeSession?.status === 'active' && (
          <section style={{ flex: 1, minHeight: 0, borderRadius: 22, overflow: 'hidden', background: t.panel, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${t.border}`, color: t.subText, fontSize: 11 }}><span>IDEA</span><span>●●● 87%</span></div>
            <div style={{ padding: 14, textAlign: 'center', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.subText }}>{activeSession.kind === 'call' ? `통화 중 · ${durationLabel(activeSession.started_at, null, now)}` : '문자 대화'}</div>
              <strong style={{ color: t.theirText }}>{sessionTitle(activeSession)}</strong>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
              {(messages[activeSession.id] || []).map(message => <div key={message.id} style={{ width: 'fit-content', maxWidth: '75%', margin: message.user_id === userId ? '0 0 9px auto' : '0 auto 9px 0', padding: '8px 11px', borderRadius: 12, background: message.user_id === userId ? t.myBubble : t.theirBubble, color: message.user_id === userId ? t.myText : t.theirText }}>{message.content}</div>)}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '10px 10px calc(10px + env(safe-area-inset-bottom))', borderTop: `1px solid ${t.border}` }}>
              <input ref={messageInputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendMessage(activeSession)} placeholder="대화를 입력…" style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 10, background: t.bg, color: t.inputText, border: `1px solid ${t.border}` }} />
              <button onPointerDown={event => event.preventDefault()} onClick={() => sendMessage(activeSession)} aria-label="전송" style={{ width: 40, border: 0, borderRadius: 10, background: t.point, color: '#fff' }}><Send size={16} /></button>
              <button onClick={() => updateSession(activeSession, 'ended')} aria-label="종료" style={{ width: 40, borderRadius: 10, border: `1px solid ${t.border}`, background: 'none', color: t.subText }}><PhoneOff size={16} /></button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
