import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Phone, PhoneOff, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { prefersReducedMotion } from '../lib/motion'
import { createClientMessageId, sendRoomMessage } from '../features/messages/messageApi'
import { Button, Card, IconButton, TextInput } from './ui'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

function durationLabel(startedAt, endedAt, now) {
  if (!startedAt) return '00:00'
  const end = endedAt ? new Date(endedAt).getTime() : now
  const displayedSeconds = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 5000))
  return `${String(Math.floor(displayedSeconds / 60)).padStart(2, '0')}:${String(displayedSeconds % 60).padStart(2, '0')}`
}

export default function CommunicationSessions({ roomId, userId, myChars, open, onClose }) {
  const [kind, setKind] = useState('call')
  const [characters, setCharacters] = useState([])
  const [senderId, setSenderId] = useState(myChars[0]?.id || '')
  const [receiverId, setReceiverId] = useState('')
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState({})
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendingSessionId, setSendingSessionId] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [characterLoadError, setCharacterLoadError] = useState('')
  const [hiddenSessionId, setHiddenSessionId] = useState(null)
  const [remoteTyping, setRemoteTyping] = useState(null)
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight)
  const [viewportOffsetTop, setViewportOffsetTop] = useState(() => window.visualViewport?.offsetTop || 0)
  const messageInputRef = useRef(null)
  const messageListRef = useRef(null)
  const communicationChannelRef = useRef(null)
  const isNearMessageBottomRef = useRef(true)
  const typingStopTimerRef = useRef(null)
  const lastTypingBroadcastRef = useRef(0)
  const sessionIdsRef = useRef(new Set())

  const activeSession = sessions.find(session => ['ringing', 'active'].includes(session.status))
  const characterById = useMemo(() => Object.fromEntries(characters.map(character => [character.id, character])), [characters])
  const receiverOptions = characters.filter(character => character.user_id !== userId)
  const effectiveSenderId = myChars.some(character => character.id === senderId) ? senderId : myChars[0]?.id || ''
  const selectedSender = myChars.find(character => character.id === effectiveSenderId)
  const selectedReceiver = receiverOptions.find(character => character.id === receiverId)
  const activeSessionId = activeSession?.id || null
  const activeSessionMessageCount = activeSession ? (messages[activeSession.id]?.length || 0) : 0
  const remoteTypingExpiresAt = remoteTyping?.expiresAt || 0

  useEffect(() => {
    sessionIdsRef.current = new Set(sessions.map(session => session.id))
  }, [sessions])

  const fetchSessions = async () => {
    const { data, error } = await supabase.from('communication_sessions').select('*').eq('room_id', roomId).in('status', ['ringing', 'active']).order('created_at', { ascending: false })
    if (error) {
      setSendError('연락 상태를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.')
      return
    }
    setSessions(data || [])
  }

  const fetchMessages = async sessionId => {
    const { data, error } = await supabase.from('communication_session_messages').select('*').eq('session_id', sessionId).order('created_at')
    if (error) {
      setSendError('저장된 대화를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
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
        if (!sessionIdsRef.current.has(payload.new.session_id)) return
        setMessages(current => {
          const sessionMessages = current[payload.new.session_id] || []
          if (sessionMessages.some(message => message.id === payload.new.id)) return current
          return { ...current, [payload.new.session_id]: [...sessionMessages, payload.new] }
        })
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.userId === userId || !sessionIdsRef.current.has(payload.sessionId)) return
        setRemoteTyping(payload.active ? payload : null)
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSendError('실시간 연결이 끊겼습니다. 연결이 복구되면 대화를 다시 불러옵니다.')
        }
      })
    communicationChannelRef.current = channel
    return () => {
      communicationChannelRef.current = null
      window.clearTimeout(typingStopTimerRef.current)
      supabase.removeChannel(channel)
    }
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
    const list = messageListRef.current
    if (!activeSessionId || !list || !isNearMessageBottomRef.current) return
    window.requestAnimationFrame(() => list.scrollTo({
      top: list.scrollHeight,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    }))
  }, [activeSessionId, activeSessionMessageCount, remoteTypingExpiresAt])

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

    let recordMessage = null
    try {
      recordMessage = await sendRoomMessage(supabase, {
        room_id: roomId,
        client_message_id: createClientMessageId(),
        character_id: null,
        type: 'communication',
        content: JSON.stringify({
          sessionId: created.id,
          kind,
          status: 'ringing',
          title: `${sender.name} → ${receiver.name}`,
          statusLabel: kind === 'call' ? '음성 통화' : '문자',
        }),
      })
    } catch (messageError) {
      setSendError(`연락 기록을 남기지 못했습니다: ${messageError.message}`)
    }

    if (recordMessage) {
      await supabase.from('communication_sessions').update({ record_message_id: recordMessage.id }).eq('id', created.id)
    }
  }

  const updateSession = async (session, status) => {
    if (sendingSessionId === session.id && ['declined', 'left', 'ended'].includes(status)) {
      setSendError('메시지 전송이 끝난 뒤 종료해주세요.')
      return
    }
    setSendError('')
    const patch = { status }
    if (status === 'active') patch.started_at = new Date().toISOString()
    if (['declined', 'left', 'ended'].includes(status)) patch.ended_at = new Date().toISOString()
    const { data: updated, error } = await supabase.from('communication_sessions').update(patch).eq('id', session.id).select().single()
    if (error || !updated) {
      setSendError('연락 상태를 변경하지 못했습니다. 다시 시도해주세요.')
      return
    }
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
      let recordMessage = null
      try {
        recordMessage = await sendRoomMessage(supabase, {
          room_id: roomId,
          client_message_id: createClientMessageId(),
          character_id: null,
          type: 'communication',
          content: recordContent,
        })
      } catch (messageError) {
        setSendError(`연락 기록을 남기지 못했습니다: ${messageError.message}`)
      }
      if (recordMessage) await supabase.from('communication_sessions').update({ record_message_id: recordMessage.id }).eq('id', session.id)
    }
  }

  const sendMessage = async session => {
    const content = draft.trim()
    if (!content || sendingSessionId === session.id) return
    setSendError('')
    setSendingSessionId(session.id)

    const { data: latestSession, error: sessionError } = await supabase
      .from('communication_sessions')
      .select('status, sender_user_id, receiver_user_id')
      .eq('id', session.id)
      .maybeSingle()

    if (sessionError || !latestSession) {
      setSendError('통화 상태를 확인하지 못했습니다. 입력 내용은 유지됩니다.')
      setSendingSessionId(null)
      return
    }
    if (latestSession.status !== 'active') {
      setSendError('이미 종료된 대화라 메시지를 보낼 수 없습니다.')
      setSendingSessionId(null)
      await fetchSessions()
      return
    }
    if (![latestSession.sender_user_id, latestSession.receiver_user_id].includes(userId)) {
      setSendError('이 대화의 참여자만 메시지를 보낼 수 있습니다.')
      setSendingSessionId(null)
      return
    }

    const characterId = session.sender_user_id === userId ? session.sender_character_id : session.receiver_character_id
    const { data: savedMessage, error } = await supabase
      .from('communication_session_messages')
      .insert({ session_id: session.id, user_id: userId, character_id: characterId, content })
      .select()
      .single()

    if (error || !savedMessage) {
      setSendError(error?.message?.includes('row-level security')
        ? '대화가 종료됐거나 전송 권한이 없어 저장하지 못했습니다.'
        : '메시지를 저장하지 못했습니다. 입력 내용은 유지되며 다시 전송할 수 있습니다.')
      setSendingSessionId(null)
      return
    }

    isNearMessageBottomRef.current = true
    setMessages(current => {
      const sessionMessages = current[session.id] || []
      if (sessionMessages.some(message => message.id === savedMessage.id)) return current
      return { ...current, [session.id]: [...sessionMessages, savedMessage] }
    })
    setDraft(current => current.trim() === content ? '' : current)
    setSendingSessionId(null)
    window.requestAnimationFrame(() => messageInputRef.current?.focus({ preventScroll: true }))
  }

  const broadcastTyping = (session, value) => {
    const channel = communicationChannelRef.current
    if (!channel) return
    const hasContent = value.trim().length > 0
    const timestamp = Date.now()
    const ownCharacterId = session.sender_user_id === userId ? session.sender_character_id : session.receiver_character_id
    const characterName = characterById[ownCharacterId]?.name || '상대방'
    const send = active => channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { sessionId: session.id, userId, characterName, active, expiresAt: timestamp + 2500 },
    })
    if (!hasContent || timestamp - lastTypingBroadcastRef.current > 900) {
      lastTypingBroadcastRef.current = timestamp
      send(hasContent)
    }
    window.clearTimeout(typingStopTimerRef.current)
    if (hasContent) typingStopTimerRef.current = window.setTimeout(() => send(false), 1800)
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
    <div className="communication-sessions" style={{ top: viewportOffsetTop, height: viewportHeight }}>
      <header className="room-panel-header communication-sessions__header">
        <strong className="room-panel-title">전화 · 문자</strong>
        <IconButton
          type="button"
          label="본 채팅방으로 돌아가기"
          className="communication-sessions__close"
          onClick={() => {
            if (activeSession) setHiddenSessionId(activeSession.id)
            onClose()
          }}>
          <X size={17} />
        </IconButton>
      </header>

      <div className="communication-sessions__body">
        {!activeSession && (
          <Card as="section">
            <div className="room-panel-tabs communication-sessions__tabs">
              <Button variant="secondary" className="room-panel-tab" data-selected={kind === 'call'} onClick={() => setKind('call')}><Phone size={15} /> 전화</Button>
              <Button variant="secondary" className="room-panel-tab" data-selected={kind === 'text'} onClick={() => setKind('text')}><MessageSquare size={15} /> 문자</Button>
            </div>
            <label className="communication-sessions__person">발신인
              <span className="room-panel-row communication-sessions__field">
                <img className="squircle-media" src={selectedSender?.image_url || DEFAULT_AVATAR} alt="" />
                <select className="ui-input" value={effectiveSenderId} onChange={event => setSenderId(event.target.value)}>
                  {myChars.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
                </select>
              </span>
            </label>
            <label className="communication-sessions__person">수신인
              <span className="room-panel-row communication-sessions__field">
                <img className="squircle-media" src={selectedReceiver?.image_url || DEFAULT_AVATAR} alt="" />
                <select className="ui-input" value={receiverId} onChange={event => setReceiverId(event.target.value)}>
                  {receiverOptions.length === 0 && <option value="">선택 가능한 상대 캐릭터 없음</option>}
                  {receiverOptions.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
                </select>
              </span>
            </label>
            {characterLoadError && <div role="status" className="room-panel-caption communication-sessions__load-error">{characterLoadError}</div>}
            <Button block className="communication-sessions__start" onClick={createSession} disabled={!effectiveSenderId || !receiverId}>연락하기</Button>
          </Card>
        )}

        {activeSession?.status === 'ringing' && (
          <section className="communication-sessions__ringing">
            <img className="squircle-media" src={counterpartCharacter(activeSession)?.image_url || DEFAULT_AVATAR} alt="" />
            <div className="communication-sessions__ringing-kind">{activeSession.kind === 'call' ? '수신 전화' : '새 문자'}</div>
            <h2>{isReceiver(activeSession) ? `${counterpartCharacter(activeSession)?.name || '상대방'}에게 ${activeSession.kind === 'call' ? '전화가' : '문자가'} 왔습니다` : `${counterpartCharacter(activeSession)?.name || '상대방'}의 응답을 기다리는 중…`}</h2>
            {isReceiver(activeSession) ? activeSession.kind === 'call' ? (
              <div className="communication-sessions__answer communication-sessions__answer--call">
                <label>
                  <IconButton type="button" label="받기" className="communication-sessions__receive" onClick={() => updateSession(activeSession, 'active')}><Phone size={27} /></IconButton>
                  받기
                </label>
                <label>
                  <IconButton type="button" label="거절" className="communication-sessions__decline" onClick={() => updateSession(activeSession, 'declined')}><PhoneOff size={27} /></IconButton>
                  거절
                </label>
              </div>
            ) : (
              <div className="communication-sessions__answer">
                <Button onClick={() => updateSession(activeSession, 'active')}>입장</Button>
                <Button variant="secondary" onClick={() => updateSession(activeSession, 'left')}>나가기</Button>
              </div>
            ) : <div className="communication-sessions__waiting">{counterpartCharacter(activeSession)?.name || '상대방'}의 응답을 기다리는 중…</div>}
          </section>
        )}

        {activeSession?.status === 'active' && (
          <Card as="section" className="communication-sessions__active">
            <div className="room-panel-caption communication-sessions__status"><span>IDEA</span><span>●●● 87%</span></div>
            <div className="communication-sessions__conversation">
              <div className="room-panel-caption">{activeSession.kind === 'call' ? `통화 중 · ${durationLabel(activeSession.started_at, null, now)}` : '문자 대화'}</div>
              <strong>{sessionTitle(activeSession)}</strong>
            </div>
            <div className="communication-sessions__messages" ref={messageListRef} onScroll={event => {
              const node = event.currentTarget
              isNearMessageBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
            }}>
              {(messages[activeSession.id] || []).map(message => (
                <div key={message.id} className="message-bubble communication-sessions__bubble" data-mine={message.user_id === userId}>{message.content}</div>
              ))}
              {remoteTyping?.sessionId === activeSession.id && remoteTyping.expiresAt > now && (
                <div className="room-panel-caption communication-sessions__typing">
                  <span>•••</span>
                  {remoteTyping.characterName} · {activeSession.kind === 'call' ? '말하는 중…' : '입력 중…'}
                </div>
              )}
            </div>
            {sendError && <div role="alert" className="room-panel-error communication-sessions__send-error">{sendError}</div>}
            <div className="room-panel-row communication-sessions__composer">
              <TextInput ref={messageInputRef} value={draft} onChange={event => { setDraft(event.target.value); broadcastTyping(activeSession, event.target.value); if (sendError) setSendError('') }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(activeSession) } }} placeholder="대화를 입력…" data-error={Boolean(sendError)} />
              <IconButton type="button" className="communication-sessions__send" disabled={sendingSessionId === activeSession.id} onPointerDown={event => event.preventDefault()} onClick={() => sendMessage(activeSession)} label={sendingSessionId === activeSession.id ? '전송 중' : '전송'}><Send size={16} /></IconButton>
              <IconButton type="button" disabled={sendingSessionId === activeSession.id} onClick={() => updateSession(activeSession, 'ended')} label="종료"><PhoneOff size={16} /></IconButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
