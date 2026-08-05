import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, uploadFile, validateImageFile } from '../lib/supabase'
import { THEMES, getTheme } from '../lib/themes'
import { ChevronLeft, Settings, Search, Images, Paperclip, ArrowUp, Eye, ArrowDown, ChevronDown, ChevronUp, Quote, RotateCcw, AlertCircle, Sparkles, Minus, Phone, MessageSquare, Copy, DoorOpen, Send, Music } from 'lucide-react'
import ProfileImageModal from '../components/ProfileImageModal'
import CommunicationSessions from '../components/CommunicationSessions'
import CommunicationRecord from '../components/CommunicationRecord'
import Toast, { useToast } from '../components/Toast'
import LoadingScreen from '../components/LoadingScreen'
import EntryCharacterPicker from '../components/EntryCharacterPicker'
import SharedBackgroundAudio from '../components/SharedBackgroundAudio'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

const SLOT_DUMMY = ['아르카디아', '세렌디아', '발타자르', '엘리시온', '카르타고', '미스트헤임', '아스가르트', '티베리우스', '에오스테르', '네크로폴리스', '이스칸다르', '팔레스트리나', '솔리투도', '아우로라', '크림슨 홀', '아르테미시아', '에테르나', '라그나렉', '세라피나', '루시페리아', '발할라', '사라진 카리나', '황혼의 언덕', '안개 낀 숲', '폐역 플랫폼', '무너진 등대', '달빛 호수', '버려진 극장', '균열된 거울 속', '세계의 끝', '첫눈의 밤', '불타는 궁전', '빗속 골목길', '끝없는 복도', '지하 서고', '잊혀진 신전', '기억의 잔해', '멈춘 도시', '옥상 위', '새벽 카페', '심야 편의점', '폭풍의 해안', '허공에 뜬 섬', '늦가을 기차역', '설원', '유성우의 밤하늘', '꿈의 경계']

const ITEM_H = 48
const WINDOW_H = 240

// 받침 유무에 따라 이/가 구분
function subjectParticle(name) {
  if (!name) return '이'
  const code = name.charCodeAt(name.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '가'
  return (code - 0xac00) % 28 === 0 ? '가' : '이'
}

function instrumentalParticle(name) {
  if (!name) return '로'
  const code = name.charCodeAt(name.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '로'
  const finalConsonant = (code - 0xac00) % 28
  return finalConsonant === 0 || finalConsonant === 8 ? '로' : '으로'
}

function SlotEntrance({ roomName, bgColor, pointColor, onDone }) {
  const reelRef = useRef(null)
  const [dots, setDots] = useState('')

  useEffect(() => {
    let count = 0
    const interval = setInterval(() => {
      count++
      setDots('.'.repeat(count % 4))
    }, 320)
    setTimeout(() => clearInterval(interval), 2600)

    if (!reelRef.current || !roomName) return
    const reel = reelRef.current

    const shuffled = [...SLOT_DUMMY].sort(() => Math.random() - 0.5)
    const before = shuffled.slice(0, 20)
    const after = shuffled.slice(0, 8)
    const items = [...before, roomName, ...after]
    const targetIdx = before.length

    reel.innerHTML = ''
    reel.style.transition = 'none'
    reel.style.transform = 'translateY(0)'

    items.forEach(text => {
      const div = document.createElement('div')
      div.textContent = text
      div.style.cssText = `height:${ITEM_H}px;line-height:${ITEM_H}px;font-size:20px;color:${pointColor}33;white-space:nowrap;text-align:center;width:100%;font-family:sans-serif;transition:font-size 0.5s ease,color 0.5s ease,height 0.5s ease,line-height 0.5s ease;`
      reel.appendChild(div)
    })

    const finalOffset = targetIdx * ITEM_H - WINDOW_H / 2 + ITEM_H / 2

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reel.style.transition = 'transform 2.6s cubic-bezier(0.05, 0.9, 0.25, 1.0)'
        reel.style.transform = `translateY(-${finalOffset}px)`

        setTimeout(() => {
          const spans = reel.querySelectorAll('div')
          spans.forEach((s, i) => {
            const dist = Math.abs(i - targetIdx)
            if (dist === 0) {
              s.style.fontSize = '36px'
              s.style.fontWeight = '600'
              s.style.color = pointColor
              s.style.height = '80px'
              s.style.lineHeight = '80px'
            } else if (dist === 1) {
              s.style.fontSize = '22px'
              s.style.color = pointColor + '88'
            }
          })
          setTimeout(() => {
            const newOffset = targetIdx * ITEM_H - WINDOW_H / 2 + 40
            reel.style.transition = 'transform 0.5s ease'
            reel.style.transform = `translateY(-${newOffset}px)`
          }, 50)
        }, 2500)

        setTimeout(onDone, 3400)
      })
    })
  }, [roomName])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: bgColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ fontSize: 20, color: pointColor + '88', letterSpacing: 3, textAlign: 'center', width: 160 }}>ENTERING{dots}</div>
      <div style={{ width: '60%', maxWidth: 260, height: 0.5, background: pointColor + '44' }} />
      <div style={{ height: `${WINDOW_H}px`, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: 360 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 2, background: `linear-gradient(to bottom, ${bgColor} 20%, transparent)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, zIndex: 2, background: `linear-gradient(to top, ${bgColor} 20%, transparent)` }} />
        <div ref={reelRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', willChange: 'transform' }} />
      </div>
      <div style={{ width: '60%', maxWidth: 260, height: 0.5, background: pointColor + '44' }} />
    </div>
  )
}

function parseContent(text, actColor, actionStyle) {
  const parts = []
  const re = /(\([^)]*\)?)/g
  let last = 0,
    m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>)
    parts.push(
      <span key={m.index} style={{ fontSize: '0.85em', color: actionStyle === 'dim' ? actColor : 'inherit', opacity: actionStyle === 'dim' ? 0.6 : 1 }}>
        {m[0]}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>)
  return parts
}

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('chat')
  const [myChars, setMyChars] = useState([])
  const [activeChar, setActiveChar] = useState(null)
  const [userId, setUserId] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [showTheme, setShowTheme] = useState(false)
  const [closingTheme, setClosingTheme] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [closingGallery, setClosingGallery] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableDates, setAvailableDates] = useState([])
  const [readReceipt, setReadReceipt] = useState('text')
  const [actionStyle, setActionStyle] = useState('dim')
  const [theme, setTheme] = useState(null)
  const [sharedThemeId, setSharedThemeId] = useState('dark-purple')
  const [followShared, setFollowShared] = useState(true)
  const [myThemeId, setMyThemeId] = useState('dark-purple')
  const [isOwner, setIsOwner] = useState(false)
  const [showSlot, setShowSlot] = useState(true)
  const [hideScroll, setHideScroll] = useState(false)
  const [newMsgAlert, setNewMsgAlert] = useState(false)
  const [roomNameText, setRoomNameText] = useState('')
  const [showCharList, setShowCharList] = useState(false)
  const [closingCharList, setClosingCharList] = useState(false)
  const [typingInfo, setTypingInfo] = useState(null)
  const [talkingFramesByCharacter, setTalkingFramesByCharacter] = useState({})
  const [talkingFrameIndex, setTalkingFrameIndex] = useState(0)
  const [showTypingIndicator, setShowTypingIndicator] = useState(true)
  const [showEntering, setShowEntering] = useState(true)
  const [showMessageTime, setShowMessageTime] = useState(true)
  const [showEditedLabel, setShowEditedLabel] = useState(true)
  const [messageMenuId, setMessageMenuId] = useState(null)
  const [imageMenuTarget, setImageMenuTarget] = useState(null)
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const [profilePreview, setProfilePreview] = useState(null)
  const [showCommunication, setShowCommunication] = useState(false)
  const [showBackgroundAudio, setShowBackgroundAudio] = useState(false)
  const [showRoleplayMenu, setShowRoleplayMenu] = useState(false)
  const [closingRoleplayMenu, setClosingRoleplayMenu] = useState(false)
  const [showRoomInvitePicker, setShowRoomInvitePicker] = useState(false)
  const [invitableRooms, setInvitableRooms] = useState([])
  const [joinedRoomIds, setJoinedRoomIds] = useState([])
  const [pendingInviteEntry, setPendingInviteEntry] = useState(null)
  const [entryCharacters, setEntryCharacters] = useState([])
  const [entryJoining, setEntryJoining] = useState(false)
  const [dividerText, setDividerText] = useState('')
  const [initialUnreadId, setInitialUnreadId] = useState(null)
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height || window.innerHeight)
  const [viewportOffsetTop, setViewportOffsetTop] = useState(() => window.visualViewport?.offsetTop || 0)
  const scrollTimerRef = useRef(null)
  const typingTimerRef = useRef(null)
  const remoteTypingTimerRef = useRef(null)
  const lastTypingSentAtRef = useRef(0)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressTriggeredRef = useRef(false)
  const profileGestureStartRef = useRef(null)
  const profileGestureHandledRef = useRef(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const messageListRef = useRef(null)
  const initialScrollDone = useRef(false)
  const channelRef = useRef(null)
  const userIdRef = useRef(null)
  const messagesRef = useRef([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!typingInfo?.characterId) {
      setTalkingFrameIndex(0)
      return undefined
    }
    const frames = talkingFramesByCharacter[typingInfo.characterId] || []
    if (frames.length === 0) return undefined
    let timer
    let current = 0
    const scheduleNextFrame = () => {
      const total = frames.length + 1
      let next = current
      while (next === current) next = Math.floor(Math.random() * total)
      current = next
      setTalkingFrameIndex(next)
      const delay = next === 0 ? 260 + Math.random() * 180 : 130 + Math.random() * 120
      timer = window.setTimeout(scheduleNextFrame, delay)
    }
    timer = window.setTimeout(scheduleNextFrame, 140 + Math.random() * 100)
    return () => window.clearTimeout(timer)
  }, [typingInfo?.characterId, talkingFramesByCharacter])

  const loadTalkingFrames = async characterId => {
    if (!characterId || Object.prototype.hasOwnProperty.call(talkingFramesByCharacter, characterId)) return
    const { data, error } = await supabase
      .from('character_talking_frames')
      .select('image_url, sort_order')
      .eq('character_id', characterId)
      .order('sort_order')
    if (!error) {
      setTalkingFramesByCharacter(current => ({ ...current, [characterId]: (data || []).map(frame => frame.image_url) }))
    }
  }

  const openPanel = panel => {
    setShowInvite(panel === 'invite')
    setShowTheme(panel === 'theme')
    setShowSearch(panel === 'search')
    setShowCalendar(panel === 'calendar')
    setShowGallery(panel === 'gallery')
    if (panel === 'theme') setClosingTheme(false)
    if (panel === 'gallery') setClosingGallery(false)
  }

  const closeThemePanel = () => {
    if (closingTheme) return
    setClosingTheme(true)
    window.setTimeout(() => {
      setShowTheme(false)
      setClosingTheme(false)
    }, 220)
  }

  const closeGalleryPanel = () => {
    if (closingGallery) return
    setClosingGallery(true)
    window.setTimeout(() => {
      setShowGallery(false)
      setClosingGallery(false)
    }, 220)
  }

  const openCharList = () => {
    setClosingCharList(false)
    setShowCharList(true)
  }

  const closeCharList = () => {
    if (!showCharList || closingCharList) return
    setClosingCharList(true)
    window.setTimeout(() => {
      setShowCharList(false)
      setClosingCharList(false)
    }, 190)
  }

  const openRoleplayMenu = () => {
    setClosingRoleplayMenu(false)
    setShowRoleplayMenu(true)
  }

  const closeRoleplayMenu = () => {
    if (!showRoleplayMenu || closingRoleplayMenu) return
    setClosingRoleplayMenu(true)
    window.setTimeout(() => {
      setShowRoleplayMenu(false)
      setClosingRoleplayMenu(false)
      setShowRoomInvitePicker(false)
    }, 190)
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user.id)
      userIdRef.current = user.id
      await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
      const { data: ownMemberships } = await supabase.from('room_members').select('room_id').eq('user_id', user.id)
      setJoinedRoomIds((ownMemberships || []).map(member => member.room_id))

      const { data: roomData } = await supabase.from('rooms').select().eq('id', roomId).single()
      setRoom(roomData)
      setReadReceipt(roomData?.read_receipt_style || 'text')
      setActionStyle(roomData?.action_style || 'dim')
      setShowTypingIndicator(roomData?.show_typing_indicator ?? true)
      setIsOwner(roomData?.created_by === user.id)

      const [{ data: profile }, { data: messageDisplaySetting }] = await Promise.all([
        supabase.from('profiles').select('theme_id, last_char_id, show_entering').eq('id', user.id).single(),
        supabase.from('profiles').select('show_message_time, show_edited_label').eq('id', user.id).maybeSingle(),
      ])
      const enteringEnabled = profile?.show_entering ?? true
      setShowEntering(enteringEnabled)
      setShowMessageTime(messageDisplaySetting?.show_message_time ?? true)
      setShowEditedLabel(messageDisplaySetting?.show_edited_label ?? true)
      if (!enteringEnabled) setShowSlot(false)
      const myId = profile?.theme_id || 'dark-purple'
      setMyThemeId(myId)

      const sharedId = roomData?.shared_theme_id || 'dark-purple'
      const follow = roomData?.theme_follow ?? true
      setSharedThemeId(sharedId)
      setFollowShared(follow)
      const resolvedTheme = getTheme(follow ? sharedId : myId)
      localStorage.setItem('idea-theme-id', myId)
      setTheme(resolvedTheme)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme.panel)

      const { data: chars } = await supabase.from('characters').select().eq('user_id', user.id).eq('is_archived', false).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      const { data: roomCharacterRows } = await supabase.from('room_characters').select('character_id, sort_order').eq('room_id', roomId).eq('user_id', user.id).order('sort_order', { ascending: true })
      const roomChars =
        roomCharacterRows && roomCharacterRows.length > 0
          ? roomCharacterRows.map(row => chars?.find(character => character.id === row.character_id)).filter(Boolean)
          : chars || []
      setMyChars(roomChars)
      if (roomChars.length > 0) {
        const { data: member } = await supabase.from('room_members').select('last_char_id').eq('room_id', roomId).eq('user_id', user.id).single()
        const lastChar = roomChars.find(c => c.id === member?.last_char_id)
        setActiveChar(lastChar || roomChars[0])
      }

      await fetchMessages()

      channelRef.current = supabase
        .channel('room-' + roomId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
          setRoom(prev => ({ ...prev, ...payload.new }))
          setShowTypingIndicator(payload.new.show_typing_indicator ?? true)
          if (payload.new.show_typing_indicator === false) setTypingInfo(null)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, payload => {
          // 상대방 타이핑 감지
          if (payload.new.user_id !== userIdRef.current) {
            const expiresAt = payload.new.typing_expires_at ? new Date(payload.new.typing_expires_at).getTime() : 0
            const remaining = expiresAt - Date.now()
            window.clearTimeout(remoteTypingTimerRef.current)
            if ((payload.new.is_typing ?? true) && payload.new.typing_char_name && remaining > 0) {
              const characterId = payload.new.typing_character_id || null
              setTypingInfo({ charName: payload.new.typing_char_name, characterId, expiresAt })
              if (characterId) loadTalkingFrames(characterId)
              remoteTypingTimerRef.current = window.setTimeout(() => setTypingInfo(null), remaining)
            } else {
              setTypingInfo(null)
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, async payload => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new
            const { data: char } = await supabase.from('characters').select('name, color, text_color, avatar_letter, image_url').eq('id', newMsg.character_id).single()
            const fullMsg = { ...newMsg, characters: char || null, entrance_side: newMsg.user_id === userIdRef.current ? 'right' : 'left' }
            setMessages(prev => {
              const hastemp = prev.find(m => m.id.toString().startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id)
              if (hastemp) return prev.map(m => (m.id === hastemp.id ? { ...fullMsg, entrance_side: null } : m))
              return [...prev, fullMsg]
            })
            if (!isAtBottomRef.current) setNewMsgAlert(true)
            const {
              data: { user: currentUser },
            } = await supabase.auth.getUser()
            if (newMsg.user_id !== currentUser.id) {
              await supabase
                .from('messages')
                .update({ read_by: [...(newMsg.read_by || []), currentUser.id] })
                .eq('id', newMsg.id)
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => (m.id === payload.new.id ? { ...m, read_by: payload.new.read_by, edited: payload.new.edited, content: payload.new.content } : m)))
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        })
        .subscribe()
    }
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      // 방 나갈 때 타이핑 상태 초기화
      if (userIdRef.current) {
        supabase
          .from('room_members')
          .update({ is_typing: false, typing_char_name: null, typing_character_id: null, typing_expires_at: null })
          .eq('room_id', roomId)
          .eq('user_id', userIdRef.current)
          .then(() => {})
      }
    }
  }, [roomId])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    const reportActiveRoom = () => {
      const visible = document.visibilityState === 'visible'
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({
          type: 'IDEA_ACTIVE_ROOM',
          roomId,
          visible,
        })
      })
    }
    const answerActiveRoomCheck = event => {
      if (event.data?.type !== 'IDEA_CHECK_ACTIVE_ROOM') return
      event.ports?.[0]?.postMessage({
        roomId,
        visible: document.visibilityState === 'visible',
      })
    }
    const reportInactiveRoom = () => {
      navigator.serviceWorker.controller?.postMessage({
        type: 'IDEA_ACTIVE_ROOM',
        roomId,
        visible: false,
      })
    }

    reportActiveRoom()
    const heartbeat = window.setInterval(reportActiveRoom, 5000)
    document.addEventListener('visibilitychange', reportActiveRoom)
    window.addEventListener('focus', reportActiveRoom)
    window.addEventListener('pageshow', reportActiveRoom)
    window.addEventListener('pagehide', reportInactiveRoom)
    navigator.serviceWorker.addEventListener('message', answerActiveRoomCheck)

    return () => {
      window.clearInterval(heartbeat)
      reportInactiveRoom()
      document.removeEventListener('visibilitychange', reportActiveRoom)
      window.removeEventListener('focus', reportActiveRoom)
      window.removeEventListener('pageshow', reportActiveRoom)
      window.removeEventListener('pagehide', reportInactiveRoom)
      navigator.serviceWorker.removeEventListener('message', answerActiveRoomCheck)
    }
  }, [roomId])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined
    const syncViewportHeight = () => {
      setViewportHeight(viewport.height)
      setViewportOffsetTop(viewport.offsetTop)
      window.requestAnimationFrame(() => {
        if (document.activeElement === inputRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        }
      })
    }
    syncViewportHeight()
    viewport.addEventListener('resize', syncViewportHeight)
    viewport.addEventListener('scroll', syncViewportHeight)
    return () => {
      viewport.removeEventListener('resize', syncViewportHeight)
      viewport.removeEventListener('scroll', syncViewportHeight)
    }
  }, [])

  useEffect(() => {
    if (!messageMenuId && !imageMenuTarget) return undefined
    const closeMenuOutside = event => {
      if (event.target.closest?.('[data-message-menu="true"]')) return
      setMessageMenuId(null)
      setImageMenuTarget(null)
    }
    document.addEventListener('pointerdown', closeMenuOutside)
    return () => document.removeEventListener('pointerdown', closeMenuOutside)
  }, [messageMenuId, imageMenuTarget])

  useEffect(() => {
    if (isAtBottomRef.current) {
      const behavior = messages.length > 0 && !initialScrollDone.current ? 'instant' : 'smooth'
      messagesEndRef.current?.scrollIntoView({ behavior })
      initialScrollDone.current = true
    }
  }, [messages])

  useEffect(() => {
    const handleFocus = () => fetchMessages()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    setNewMsgAlert(false)
    isAtBottomRef.current = true
  }

  const handleScroll = () => {
    const el = messageListRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setHideScroll(false)
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => setHideScroll(true), 1500)
    if (isAtBottomRef.current) setNewMsgAlert(false)
  }

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*, characters(name, color, text_color, avatar_letter, image_url)').eq('room_id', roomId).order('created_at', { ascending: true })
    if (data) {
      if (!initialScrollDone.current && userIdRef.current) {
        const firstUnread = data.find(message => message.user_id !== userIdRef.current && !(message.read_by || []).includes(userIdRef.current))
        setInitialUnreadId(firstUnread?.id || null)
      }
      window.clearTimeout(remoteTypingTimerRef.current)
      setMessages(data)
      markAsRead(data)
      const dates = [...new Set(data.map(m => new Date(m.created_at).toLocaleDateString('ko-KR')))]
      setAvailableDates(dates)
    }
  }

  const markAsRead = async msgs => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const unread = msgs.filter(m => m.user_id !== user.id && !m.read_by?.includes(user.id) && m.type !== 'chapter' && !m.id.toString().startsWith('temp-'))
    if (unread.length === 0) return
    await Promise.all(
      unread.map(m =>
        supabase
          .from('messages')
          .update({ read_by: [...(m.read_by || []), user.id] })
          .eq('id', m.id)
      )
    )
    setMessages(prev => prev.map(m => (unread.find(u => u.id === m.id) ? { ...m, read_by: [...(m.read_by || []), user.id] } : m)))
  }

  const handleTyping = async e => {
    if (!showTypingIndicator || !activeChar || !userIdRef.current) return
    const hasContent = e.target.value.trim().length > 0
    const currentTime = Date.now()
    const shouldRefresh = hasContent && currentTime - lastTypingSentAtRef.current >= 2000

    if (shouldRefresh) {
      lastTypingSentAtRef.current = currentTime
      await supabase
        .from('room_members')
        .update({
          is_typing: true,
          typing_char_name: activeChar.name,
          typing_character_id: activeChar.id,
          typing_expires_at: new Date(currentTime + 5000).toISOString(),
        })
        .eq('room_id', roomId)
        .eq('user_id', userIdRef.current)
    }

    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(async () => {
      lastTypingSentAtRef.current = 0
      await supabase
        .from('room_members')
        .update({ is_typing: false, typing_char_name: null, typing_character_id: null, typing_expires_at: null })
        .eq('room_id', roomId)
        .eq('user_id', userIdRef.current)
    }, hasContent ? 5000 : 0)
  }

  const persistMessage = async (tempId, message) => {
    setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, delivery_state: 'sending' } : m)))
    const { error } = await supabase.from('messages').insert(message)
    if (error) {
      console.error('message insert failed:', error.message)
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, delivery_state: 'failed' } : m)))
      const queue = JSON.parse(localStorage.getItem('idea-pending-messages') || '[]').filter(item => item.tempId !== tempId)
      localStorage.setItem('idea-pending-messages', JSON.stringify([...queue, { tempId, message, roomId }]))
      return false
    }
    const queue = JSON.parse(localStorage.getItem('idea-pending-messages') || '[]').filter(item => item.tempId !== tempId)
    localStorage.setItem('idea-pending-messages', JSON.stringify(queue))
    return true
  }

  const retryMessage = msg =>
    persistMessage(msg.id, {
      room_id: msg.room_id,
      user_id: msg.user_id,
      character_id: msg.character_id,
      type: msg.type,
      content: msg.content,
    })

  useEffect(() => {
    const retryPending = async () => {
      if (!navigator.onLine) return
      const queue = JSON.parse(localStorage.getItem('idea-pending-messages') || '[]').filter(item => item.roomId === roomId)
      for (const item of queue) {
        const existing = messagesRef.current.find(message => message.id === item.tempId)
        if (!existing) {
          setMessages(current => [...current, { ...item.message, id: item.tempId, created_at: new Date().toISOString(), delivery_state: 'failed' }])
        }
        await persistMessage(item.tempId, item.message)
      }
    }
    window.addEventListener('online', retryPending)
    retryPending()
    return () => window.removeEventListener('online', retryPending)
  }, [roomId])

  const sendMessage = async () => {
    if (!input.trim()) return
    const content = input.trim().replace(/\(([^)]*$)/g, '($1)')
    setInput('')

    // 전송 시 타이핑 상태 즉시 해제
    clearTimeout(typingTimerRef.current)
    if (userIdRef.current) {
      supabase
        .from('room_members')
        .update({ is_typing: false, typing_char_name: null, typing_character_id: null, typing_expires_at: null })
        .eq('room_id', roomId)
        .eq('user_id', userIdRef.current)
        .then(() => {})
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const isNarr = mode === 'narration'
    if (isNarr && messages.length > 0) {
      const last = messages[messages.length - 1]
      if (last.type === 'narration' && last.user_id === user.id) {
        const merged = last.content + '\n' + content
        setMessages(prev => prev.map(m => (m.id === last.id ? { ...m, content: merged } : m)))
        inputRef.current?.focus()
        await supabase.from('messages').update({ content: merged }).eq('id', last.id)
        return
      }
    }

    const tempMsg = {
      id: 'temp-' + Date.now(),
      room_id: roomId,
      user_id: user.id,
      character_id: isNarr ? null : activeChar?.id,
      characters: activeChar ? { name: activeChar.name, color: activeChar.color, text_color: activeChar.text_color, avatar_letter: activeChar.avatar_letter, image_url: activeChar.image_url } : null,
      type: isNarr ? 'narration' : 'chat',
      content,
      edited: false,
      created_at: new Date().toISOString(),
      delivery_state: 'sending',
      entrance_side: 'right',
    }
    isAtBottomRef.current = true
    setMessages(prev => [...prev, tempMsg])
    if (mode === 'narration') setMode('chat')
    inputRef.current?.focus()
    await persistMessage(tempMsg.id, {
      room_id: roomId,
      user_id: user.id,
      character_id: isNarr ? null : activeChar?.id,
      type: isNarr ? 'narration' : 'chat',
      content,
    })
  }

  const editMessage = async id => {
    if (!editText.trim()) return
    const { error } = await supabase.from('messages').update({ content: editText.trim(), edited: true }).eq('id', id).eq('user_id', userId)
    if (error) {
      alert('메시지를 수정하지 못했어요.')
      return
    }
    setEditingId(null)
    setEditText('')
  }

  const startEditingMessage = msg => {
    setMessageMenuId(null)
    setEditingId(msg.id)
    setEditText(msg.content)
  }

  const deleteMessage = async msg => {
    if (!confirm('이 메시지를 삭제할까요?')) return
    setMessageMenuId(null)
    setDeletingMessageId(msg.id)
    const { error } = await supabase.from('messages').delete().eq('id', msg.id).eq('user_id', userId)
    setDeletingMessageId(null)
    if (error) {
      alert('메시지를 삭제하지 못했어요.')
      return
    }
    setMessages(prev => prev.filter(m => m.id !== msg.id))
  }

  const deleteGalleryImage = async item => {
    if (!item?.message || item.message.user_id !== userId) return
    setImageMenuTarget(null)

    const message = item.message
    if (message.type === 'image') {
      await deleteMessage(message)
      return
    }

    let urls = []
    try {
      urls = JSON.parse(message.content)
    } catch {
      return
    }
    if (!confirm('이 이미지를 삭제할까요?')) return
    const nextUrls = urls.filter((_, index) => index !== item.imageIndex)
    if (nextUrls.length === 0) {
      await deleteMessage(message)
      return
    }

    const nextContent = JSON.stringify(nextUrls)
    const { error } = await supabase
      .from('messages')
      .update({ content: nextContent, edited: true })
      .eq('id', message.id)
      .eq('user_id', userId)
    if (error) {
      alert('이미지를 삭제하지 못했어요.')
      return
    }
    setMessages(prev => prev.map(entry => (entry.id === message.id ? { ...entry, content: nextContent, edited: true } : entry)))
    setProfilePreview(null)
  }

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
    longPressStartRef.current = null
  }

  const startLongPress = (event, msg) => {
    if (msg.user_id !== userId || msg.id.toString().startsWith('temp-')) return
    cancelLongPress()
    longPressTriggeredRef.current = false
    longPressStartRef.current = { x: event.clientX, y: event.clientY }
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setMessageMenuId(msg.id)
      longPressTimerRef.current = null
    }, 550)
  }

  const moveLongPress = event => {
    const start = longPressStartRef.current
    if (!start) return
    if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) {
      cancelLongPress()
    }
  }

  const openImageMessage = (url, urls = [url], index = 0) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    setProfilePreview({ url, urls, index, name: '' })
  }

  const saveRoomName = async () => {
    if (!roomNameText.trim()) return
    const { error } = await supabase.from('rooms').update({ name: roomNameText.trim() }).eq('id', roomId)
    if (error) {
      showToast('대화방 이름을 저장하지 못했어요.', 'error')
      return
    }
    setRoom(prev => ({ ...prev, name: roomNameText.trim() }))
    setRoomNameText('')
    showToast('대화방 이름이 저장됐어요.')
  }

  const saveSharedTheme = async id => {
    setSharedThemeId(id)
    if (followShared) setTheme(getTheme(id))
    const { error } = await supabase.from('rooms').update({ shared_theme_id: id }).eq('id', roomId)
    showToast(error ? '공유 테마를 저장하지 못했어요.' : '공유 테마가 저장됐어요.', error ? 'error' : 'success')
  }

  const toggleFollow = async val => {
    setFollowShared(val)
    setTheme(getTheme(val ? sharedThemeId : myThemeId))
    const { error } = await supabase.from('rooms').update({ theme_follow: val }).eq('id', roomId)
    showToast(error ? '테마 설정을 저장하지 못했어요.' : '테마 설정이 저장됐어요.', error ? 'error' : 'success')
  }

  const leaveRoom = async () => {
    if (isOwner) {
      showToast('방장은 대화방을 나갈 수 없어요.', 'error')
      return
    }
    if (!confirm('이 대화방에서 나갈까요?')) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const leavingCharacter = activeChar || myChars[0]
    const leavingName = leavingCharacter?.name || '사용자'
    await supabase.from('messages').insert({
      room_id: roomId,
      user_id: user.id,
      character_id: leavingCharacter?.id || null,
      type: 'member_left',
      content: `${leavingName}님이 대화방에서 나갔어요.`,
    })
    const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id)
    if (error) {
      showToast('대화방에서 나가지 못했어요.', 'error')
      return
    }
    navigate('/')
  }

  const sendImage = async file => {
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) {
      alert(validationError)
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const uniqueId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `chat/${roomId}/${uniqueId}.${ext}`
    const localUrl = URL.createObjectURL(file)
    const tempMsg = {
      id: `temp-image-${uniqueId}`,
      room_id: roomId,
      user_id: user.id,
      character_id: activeChar?.id,
      characters: activeChar ? { name: activeChar.name, color: activeChar.color, text_color: activeChar.text_color, avatar_letter: activeChar.avatar_letter, image_url: activeChar.image_url } : null,
      type: 'image',
      content: localUrl,
      edited: false,
      created_at: new Date().toISOString(),
      delivery_state: 'uploading',
      upload_progress: 0,
      entrance_side: 'right',
    }
    setMessages(prev => [...prev, tempMsg])
    const url = await uploadFile(file, path, progress => {
      setMessages(current => current.map(message => (message.id === tempMsg.id ? { ...message, upload_progress: progress } : message)))
    })
    if (!url) {
      setMessages(current => current.map(message => (message.id === tempMsg.id ? { ...message, delivery_state: 'upload_failed' } : message)))
      return
    }
    setMessages(current => current.map(message => (message.id === tempMsg.id ? { ...message, content: url, upload_progress: 100, delivery_state: 'sending' } : message)))
    window.requestAnimationFrame(() => URL.revokeObjectURL(localUrl))
    await persistMessage(tempMsg.id, {
      room_id: roomId,
      user_id: user.id,
      character_id: activeChar?.id,
      type: 'image',
      content: url,
    })
  }

  const startImageLongPress = (event, message, imageIndex) => {
    if (message.user_id !== userId || message.id.toString().startsWith('temp-')) return
    event.stopPropagation()
    cancelLongPress()
    longPressTriggeredRef.current = false
    longPressStartRef.current = { x: event.clientX, y: event.clientY }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      setMessageMenuId(null)
      setImageMenuTarget({ message, imageIndex })
      longPressTimerRef.current = null
    }, 550)
  }

  const sendDivider = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const content = dividerText.trim() || '구분선'
    const divider = {
      id: 'temp-' + Date.now(),
      room_id: roomId,
      user_id: user.id,
      character_id: null,
      type: 'chapter',
      content,
      edited: false,
      created_at: new Date().toISOString(),
      delivery_state: 'sending',
      entrance_side: 'right',
    }
    setMessages(current => [...current, divider])
    closeRoleplayMenu()
    await persistMessage(divider.id, {
      room_id: roomId,
      user_id: user.id,
      character_id: null,
      type: 'chapter',
      content,
    })
    setDividerText('')
  }

  const copyInviteCode = async () => {
    if (!room?.invite_code) return
    try {
      await navigator.clipboard.writeText(room.invite_code)
      showToast('초대 코드를 복사했어요.')
    } catch {
      showToast('초대 코드를 복사하지 못했어요.', 'error')
    }
  }

  const loadInvitableRooms = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('room_members').select('room_id, rooms(id, name)').eq('user_id', user.id)
    if (error) {
      showToast('초대할 방 목록을 불러오지 못했어요.', 'error')
      return
    }
    setInvitableRooms((data || []).map(item => item.rooms).filter(targetRoom => targetRoom && targetRoom.id !== roomId))
    setShowRoomInvitePicker(true)
  }

  const sendRoomInvite = async targetRoom => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const tempId = `temp-room-invite-${Date.now()}`
    const content = JSON.stringify({ roomId: targetRoom.id, roomName: targetRoom.name })
    const tempMessage = {
      id: tempId,
      room_id: roomId,
      user_id: user.id,
      character_id: activeChar?.id || null,
      characters: activeChar || null,
      type: 'room_invite',
      content,
      created_at: new Date().toISOString(),
      delivery_state: 'sending',
      entrance_side: 'right',
    }
    setMessages(current => [...current, tempMessage])
    await persistMessage(tempId, {
      room_id: roomId,
      user_id: user.id,
      character_id: activeChar?.id || null,
      type: 'room_invite',
      content,
    })
    setShowRoomInvitePicker(false)
    closeRoleplayMenu()
    showToast(`${targetRoom.name} 초대를 보냈어요.`)
  }

  const enterInvitedRoom = async invite => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: existingMember } = await supabase.from('room_members').select('room_id').eq('room_id', invite.roomId).eq('user_id', user.id).maybeSingle()
    if (existingMember) {
      navigate(`/room/${invite.roomId}`)
      return
    }
    const { data: characters } = await supabase.from('characters').select('*').eq('user_id', user.id).eq('is_archived', false).order('sort_order').order('created_at')
    setEntryCharacters(characters || [])
    setPendingInviteEntry(invite)
  }

  const completeInvitedRoomEntry = async character => {
    if (!pendingInviteEntry || !character) return
    setEntryJoining(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { count } = await supabase.from('room_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    const { error } = await supabase.from('room_members').insert({
      room_id: pendingInviteEntry.roomId,
      user_id: user.id,
      sort_order: count || 0,
      last_char_id: character.id,
    })
    if (error) {
      setEntryJoining(false)
      showToast('방 초대를 수락하지 못했어요.', 'error')
      return
    }
    await supabase.from('room_characters').upsert({
      room_id: pendingInviteEntry.roomId,
      user_id: user.id,
      character_id: character.id,
      sort_order: 0,
    })
    await supabase.from('messages').insert({
      room_id: pendingInviteEntry.roomId,
      user_id: user.id,
      character_id: character.id,
      type: 'member_joined',
      content: `${character.name}님이 대화방에 들어왔어요.`,
    })
    const targetRoomId = pendingInviteEntry.roomId
    setJoinedRoomIds(current => [...new Set([...current, targetRoomId])])
    setEntryJoining(false)
    setPendingInviteEntry(null)
    navigate(`/room/${targetRoomId}`)
  }

  const sendImages = async fileList => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    const invalid = files.map(validateImageFile).find(Boolean)
    if (invalid) {
      alert(invalid)
      return
    }
    if (files.length === 1) {
      await sendImage(files[0])
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const groupId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const localUrls = files.map(file => URL.createObjectURL(file))
      const progressByFile = files.map(() => 0)
      const tempMsg = {
        id: `temp-image-group-${groupId}`,
        room_id: roomId,
        user_id: user.id,
        character_id: activeChar?.id,
        characters: activeChar ? { name: activeChar.name, color: activeChar.color, text_color: activeChar.text_color, avatar_letter: activeChar.avatar_letter, image_url: activeChar.image_url } : null,
        type: 'image_group',
        content: JSON.stringify(localUrls),
        edited: false,
        created_at: new Date().toISOString(),
        delivery_state: 'uploading',
        upload_progress: 0,
        entrance_side: 'right',
      }
      setMessages(current => [...current, tempMsg])
      const uploadedUrls = await Promise.all(
        files.map(async (file, index) => {
          const ext = file.name.split('.').pop()
          const path = `chat/${roomId}/${groupId}-${index}.${ext}`
          return uploadFile(file, path, progress => {
            progressByFile[index] = progress
            const totalProgress = Math.round(progressByFile.reduce((sum, value) => sum + value, 0) / progressByFile.length)
            setMessages(current => current.map(message => (message.id === tempMsg.id ? { ...message, upload_progress: totalProgress } : message)))
          })
        })
      )
      const successfulUrls = uploadedUrls.filter(Boolean)
      window.requestAnimationFrame(() => localUrls.forEach(url => URL.revokeObjectURL(url)))
      if (successfulUrls.length === 0) {
        setMessages(current => current.map(message => (message.id === tempMsg.id ? { ...message, delivery_state: 'upload_failed' } : message)))
      } else {
        const content = JSON.stringify(successfulUrls)
        setMessages(current => current.map(message => (message.id === tempMsg.id ? { ...message, content, upload_progress: 100, delivery_state: 'sending' } : message)))
        await persistMessage(tempMsg.id, {
          room_id: roomId,
          user_id: user.id,
          character_id: activeChar?.id,
          type: 'image_group',
          content,
        })
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const exportChat = () => {
    const lines = messages
      .filter(message => !message.id.toString().startsWith('temp-'))
      .map(message => {
        const time = new Date(message.created_at).toLocaleString('ko-KR')
        const speaker = message.type === 'narration' ? '나레이션' : message.characters?.name || '알 수 없음'
        let content = message.type === 'image' ? `[이미지] ${message.content}` : message.content
        if (message.type === 'image_group') {
          try {
            content = `[이미지 ${JSON.parse(message.content).length}장]`
          } catch {
            content = '[이미지 묶음]'
          }
        }
        return `[${time}] ${speaker}\n${content}`
      })
    const blob = new Blob([`${room?.name || 'IDEA 채팅'}\n\n${lines.join('\n\n')}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(room?.name || 'idea-chat').replace(/[\\/:*?"<>|]/g, '_')}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const t = theme || getTheme('dark-purple')

  const renderMessageActions = (msg, canEdit = true) => {
    if (messageMenuId !== msg.id) return null
    return (
      <div
        className="message-action-menu"
        data-message-menu="true"
        onPointerDown={event => event.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 5,
          border: `1px solid ${t.border}`,
          borderRadius: 9,
          overflow: 'hidden',
          background: t.panel,
          boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
        }}>
        {canEdit && (
          <>
            <button onClick={() => startEditingMessage(msg)} style={{ border: 0, background: 'none', color: t.theirText, padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>
              수정
            </button>
            <div style={{ width: 1, alignSelf: 'stretch', background: t.border }} />
          </>
        )}
        <button disabled={deletingMessageId === msg.id} onClick={() => deleteMessage(msg)} style={{ border: 0, background: 'none', color: '#f87171', padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>
          삭제
        </button>
      </div>
    )
  }
  const renderDeliveryStatus = msg => {
    if (msg.delivery_state === 'uploading') {
      const progress = Math.max(0, Math.min(100, msg.upload_progress || 0))
      return (
        <div style={{ width: 150, marginTop: 5 }}>
          <div style={{ marginBottom: 3, color: t.subText, fontSize: 10 }}>업로드 중 {progress}%</div>
          <div style={{ height: 3, overflow: 'hidden', borderRadius: 2, background: t.border }}>
            <div style={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: t.point, transition: 'width 120ms linear' }} />
          </div>
        </div>
      )
    }
    if (msg.delivery_state === 'upload_failed') return <span style={{ marginTop: 4, color: '#f87171', fontSize: 10 }}>파일 업로드 실패</span>
    if (msg.delivery_state === 'sending')
      return (
        <span style={{ position: 'absolute', right: 43, bottom: -7, color: t.subText, fontSize: 9, lineHeight: 1, opacity: 0.62, pointerEvents: 'none' }}>
          전송 중…
        </span>
      )
    if (msg.delivery_state !== 'failed') return null
    return (
      <button
        onClick={() => retryMessage(msg)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '5px 8px', border: '1px solid #f8717188', borderRadius: 9, color: '#fca5a5', background: '#f8717114', fontSize: 10, cursor: 'pointer' }}>
        <AlertCircle size={12} />
        전송 실패
        <RotateCcw size={12} />
        다시 시도
      </button>
    )
  }
  const isNarrActive = mode === 'narration'
  const finishMessageEntrance = messageId => {
    setMessages(prev => prev.map(message => (message.id === messageId ? { ...message, entrance_side: null } : message)))
  }
  const filteredMessages = messages.filter(msg => {
    if (!searchQuery) return true
    return msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
  })
  const galleryItems = messages.flatMap(message => {
    if (message.type === 'image') {
      return message.content ? [{ url: message.content, message, imageIndex: 0 }] : []
    }
    if (message.type !== 'image_group') return []
    try {
      const urls = JSON.parse(message.content)
      return Array.isArray(urls) ? urls.filter(Boolean).map((url, imageIndex) => ({ url, message, imageIndex })) : []
    } catch {
      return []
    }
  })
  const galleryUrls = galleryItems.map(item => item.url)
  const galleryPreviewItems = galleryItems.map(item => ({
    url: item.url,
    uploader: item.message.characters?.name || '알 수 없음',
    createdAt: item.message.created_at,
  }))
  const galleryGroups = galleryItems.reduce((groups, item) => {
    const dateKey = new Date(item.message.created_at).toLocaleDateString('ko-KR')
    const existing = groups.find(group => group.date === dateKey)
    if (existing) existing.items.push(item)
    else groups.push({ date: dateKey, items: [item] })
    return groups
  }, [])
  const lastTypingProfileMessageId = typingInfo?.characterId
    ? filteredMessages.reduce((lastId, message, index) => {
        if (message.character_id !== typingInfo.characterId || message.user_id === userId) return lastId
        if (!['chat', 'image', 'image_group'].includes(message.type)) return lastId
        const previousMessage = filteredMessages[index - 1]
        const showsIdentity =
          !previousMessage ||
          previousMessage.type === 'chapter' ||
          previousMessage.type === 'narration' ||
          previousMessage.character_id !== message.character_id ||
          previousMessage.user_id !== message.user_id
        return showsIdentity ? message.id : lastId
      }, null)
    : null
  const talkingAvatarUrl = message => {
    if (message.id !== lastTypingProfileMessageId || !typingInfo?.characterId) return message.characters?.image_url || DEFAULT_AVATAR
    const frames = talkingFramesByCharacter[typingInfo.characterId] || []
    if (talkingFrameIndex === 0 || frames.length === 0) return message.characters?.image_url || DEFAULT_AVATAR
    return frames[(talkingFrameIndex - 1) % frames.length]
  }
  const lastReadMessageId = [...filteredMessages].reverse().find(msg => msg.user_id === userId && (msg.read_by || []).some(id => id !== msg.user_id))?.id

  const iconBtn = (onClick, icon, active) => ({
    onClick,
    style: { width: 36, height: 36, background: active ? t.point + '1f' : 'none', border: 'none', borderRadius: 10, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  })

  if (!theme)
    return <LoadingScreen />

  return (
    <div
      style={{
        position: 'fixed',
        top: viewportOffsetTop,
        left: 0,
        right: 0,
        width: '100%',
        height: viewportHeight,
        overflow: 'hidden',
        background: t.bg,
        '--scrollbar-color': t.border,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        animation: !showEntering ? 'slide-in-right 0.3s ease' : 'none',
      }}>
      <Toast toast={toast} />
      <EntryCharacterPicker
        open={Boolean(pendingInviteEntry)}
        roomName={pendingInviteEntry?.roomName}
        characters={entryCharacters}
        theme={t}
        loading={entryJoining}
        onSelect={completeInvitedRoomEntry}
        onClose={() => !entryJoining && setPendingInviteEntry(null)}
      />
      <ProfileImageModal profile={profilePreview} onClose={() => setProfilePreview(null)} />
      <CommunicationSessions roomId={roomId} userId={userId} myChars={myChars} theme={t} open={showCommunication} onClose={() => setShowCommunication(false)} />
      <SharedBackgroundAudio roomId={roomId} userId={userId} theme={t} open={showBackgroundAudio} onClose={() => setShowBackgroundAudio(false)} />
      {showSlot && room && showEntering && (
        <SlotEntrance
          roomName={room.name}
          bgColor={t.bg}
          pointColor={t.point}
          onDone={() => {
            setShowSlot(false)
          }}
        />
      )}

      {/* 헤더 */}
      <div
        style={{
          background: 'transparent',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 10,
          isolation: 'isolate',
        }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            zIndex: -1,
            inset: '0 0 -17px',
            pointerEvents: 'none',
            background: `linear-gradient(to bottom, color-mix(in srgb, ${t.panel} 68%, transparent) 0%, color-mix(in srgb, ${t.panel} 48%, transparent) 42%, color-mix(in srgb, ${t.panel} 18%, transparent) 72%, transparent 100%)`,
            backdropFilter: 'blur(9px)',
            WebkitBackdropFilter: 'blur(9px)',
            maskImage: 'linear-gradient(to bottom, #000 0%, #000 46%, rgba(0,0,0,0.72) 68%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 46%, rgba(0,0,0,0.72) 68%, transparent 100%)',
          }}
        />
        <button onClick={() => navigate('/')} style={{ width: 32, height: 36, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={22} color={t.subText} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.theirText, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room?.name}</div>
        </div>
        <button {...iconBtn(() => openPanel(showSearch ? null : 'search'), null, showSearch)}>
          <Search size={15} color={showSearch ? t.point : t.subText} />
        </button>
        <button
          {...iconBtn(() => (showGallery ? closeGalleryPanel() : openPanel('gallery')), null, showGallery)}
          aria-label="대화방 갤러리">
          <Images size={15} color={showGallery ? t.point : t.subText} />
        </button>
        <button {...iconBtn(() => (showTheme ? closeThemePanel() : openPanel('theme')), null, showTheme)}>
          <Settings size={15} color={showTheme ? t.point : t.subText} />
        </button>
      </div>

      {/* 초대 코드 패널 */}
      {showInvite && (
        <div className="top-panel-backdrop" style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowInvite(false)}>
          <div className="top-panel-sheet" style={{ background: t.panel, padding: '14px 16px', borderBottom: `0.5px solid ${t.border}`, textAlign: 'center', maxWidth: 480, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: t.subText, marginBottom: 4 }}>초대 코드</div>
            <button onClick={copyInviteCode} style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 7, border: 0, background: 'none', color: t.point, cursor: 'pointer' }}>
              <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3 }}>{room?.invite_code}</span>
              <Copy size={15} />
            </button>
            <div style={{ fontSize: 10, color: t.subText, marginTop: 4, opacity: 0.6 }}>상대방에게 이 코드를 알려주세요</div>
          </div>
        </div>
      )}

      {/* 테마 패널 */}
      {showTheme && (
        <div className={`top-panel-backdrop${closingTheme ? ' settings-backdrop-closing' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.24)' }} onClick={closeThemePanel}>
          <div className={`top-panel-sheet settings-page-drawer${closingTheme ? ' is-closing' : ''}`} style={{ background: t.panel, padding: '14px', borderLeft: `0.5px solid ${t.border}`, maxWidth: 480, marginLeft: 'auto', width: '100%', height: '100%', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ flex: 1, fontSize: 15, color: t.theirText }}>대화방 설정</div>
              <button onClick={closeThemePanel} style={{ border: `1px solid ${t.border}`, borderRadius: 9, background: 'none', color: t.subText, padding: '6px 10px' }}>닫기</button>
            </div>
            <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: t.bg, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10, color: t.subText }}>초대 코드</div>
              <button onClick={copyInviteCode} style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 7, padding: 0, border: 0, background: 'none', color: t.point, letterSpacing: 2, cursor: 'pointer' }}>
                {room?.invite_code}
                <Copy size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
              <button
                onClick={() => {
                  closeThemePanel()
                  setShowCalendar(true)
                }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: `1px solid ${t.border}`, background: 'none', color: t.theirText }}>
                날짜로 이동
              </button>
              <button onClick={exportChat} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: `1px solid ${t.border}`, background: 'none', color: t.theirText }}>
                채팅 내보내기
              </button>
            </div>
            <div style={{ fontSize: 11, color: t.subText, marginBottom: 10 }}>채팅방 테마 설정</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 10px', background: t.bg, borderRadius: 8, border: `0.5px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: t.theirText }}>공유 테마 따라가기</div>
                <div style={{ fontSize: 10, color: t.subText, marginTop: 2 }}>방장이 설정한 테마로 보기</div>
              </div>
              <div onClick={() => toggleFollow(!followShared)} style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s', background: followShared ? t.point : t.border, position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: followShared ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            {isOwner && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: t.subText, marginBottom: 8 }}>
                  공유 테마 <span style={{ fontSize: 10, opacity: 0.6 }}>(방장만 변경 가능)</span>
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {THEMES.map(th => (
                    <div key={th.id} onClick={() => saveSharedTheme(th.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', border: sharedThemeId === th.id ? `2px solid ${th.point}` : `1px solid ${th.border}` }}>
                        <div style={{ height: '40%', background: th.panel, borderBottom: `0.5px solid ${th.border}` }} />
                        <div style={{ height: '60%', background: th.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <div style={{ width: 10, height: 8, borderRadius: '1px 5px 5px 5px', background: th.theirBubble, border: `0.5px solid ${th.theirBorder}` }} />
                          <div style={{ width: 10, height: 8, borderRadius: '5px 1px 5px 5px', background: th.myBubble }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: sharedThemeId === th.id ? th.point : t.subText, whiteSpace: 'nowrap' }}>{th.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, color: t.subText, width: 70 }}>읽음 확인</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['text', 'number', 'none'].map(s => (
                  <button
                    key={s}
                    onClick={async () => {
                      setReadReceipt(s)
                      const { error } = await supabase.from('rooms').update({ read_receipt_style: s }).eq('id', roomId)
                      showToast(error ? '읽음 확인 설정을 저장하지 못했어요.' : '읽음 확인 설정이 저장됐어요.', error ? 'error' : 'success')
                    }}
                    style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: readReceipt === s ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}`, background: readReceipt === s ? t.point + '22' : 'none', color: readReceipt === s ? t.point : t.subText }}>
                    {s === 'text' ? '읽음' : s === 'number' ? '1' : '없음'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 12, color: t.subText, width: 70 }}>지문 스타일</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { val: 'dim', label: '흐리게' },
                  { val: 'bright', label: '밝게' },
                ].map(s => (
                  <button
                    key={s.val}
                    onClick={async () => {
                      setActionStyle(s.val)
                      const { error } = await supabase.from('rooms').update({ action_style: s.val }).eq('id', roomId)
                      showToast(error ? '지문 스타일을 저장하지 못했어요.' : '지문 스타일이 저장됐어요.', error ? 'error' : 'success')
                    }}
                    style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: actionStyle === s.val ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}`, background: actionStyle === s.val ? t.point + '22' : 'none', color: actionStyle === s.val ? t.point : t.subText }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, padding: '8px 10px', background: t.bg, borderRadius: 8, border: `0.5px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: t.theirText }}>입력 중 표시</div>
                <div style={{ marginTop: 2, fontSize: 10, color: t.subText }}>{isOwner ? '이 방에서 작성 중 상태를 표시합니다.' : '방장만 변경할 수 있습니다.'}</div>
              </div>
              <button
                type="button"
                disabled={!isOwner}
                aria-label="입력 중 표시 전환"
                aria-pressed={showTypingIndicator}
                onClick={async () => {
                  if (!isOwner) return
                  const next = !showTypingIndicator
                  setShowTypingIndicator(next)
                  if (!next) setTypingInfo(null)
                  const { error } = await supabase.from('rooms').update({ show_typing_indicator: next }).eq('id', roomId)
                  if (error) setShowTypingIndicator(!next)
                  showToast(error ? '입력 중 표시 설정을 저장하지 못했어요.' : '입력 중 표시 설정이 저장됐어요.', error ? 'error' : 'success')
                }}
                style={{ position: 'relative', width: 40, height: 22, flexShrink: 0, padding: 0, border: 0, borderRadius: 11, cursor: isOwner ? 'pointer' : 'default', opacity: isOwner ? 1 : 0.55, background: showTypingIndicator ? t.point : t.border }}>
                <span style={{ position: 'absolute', top: 3, left: showTypingIndicator ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
            {isOwner && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: t.subText, marginBottom: 6 }}>방 이름</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={roomNameText} onChange={e => setRoomNameText(e.target.value)} onFocus={() => setRoomNameText(room?.name || '')} onKeyDown={e => e.key === 'Enter' && saveRoomName()} placeholder={room?.name} style={{ flex: 1, background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '5px 10px', color: t.inputText, fontSize: 12, outline: 'none' }} />
                  <button onClick={saveRoomName} style={{ background: t.point, border: 'none', borderRadius: 8, padding: '5px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    저장
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: t.subText, marginBottom: 6 }}>대표 이미지</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="squircle-media" style={{ width: 53, height: 53, background: t.bg, border: `0.5px solid ${t.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: t.subText, flexShrink: 0 }}>{room?.cover_image ? <img src={room.cover_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '✦'}</div>
                    <label style={{ flex: 1, background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '5px 12px', color: t.subText, fontSize: 12, cursor: 'pointer', textAlign: 'center' }}>
                      이미지 선택
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files[0]
                          if (!file) return
                          const ext = file.name.split('.').pop()
                          const path = `rooms/${roomId}/${Date.now()}.${ext}`
                          const url = await uploadFile(file, path)
                          if (url) {
                            await supabase.from('rooms').update({ cover_image: url }).eq('id', roomId)
                            setRoom(prev => ({ ...prev, cover_image: url }))
                          }
                        }}
                      />
                    </label>
                    {room?.cover_image && (
                      <button
                        onClick={async () => {
                          await supabase.from('rooms').update({ cover_image: null }).eq('id', roomId)
                          setRoom(prev => ({ ...prev, cover_image: null }))
                        }}
                        style={{ background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '5px 10px', color: t.subText, fontSize: 12, cursor: 'pointer' }}>
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 검색 패널 */}
      {showGallery && (
        <div
          className={`top-panel-backdrop${closingGallery ? ' settings-backdrop-closing' : ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.24)' }}
          onClick={closeGalleryPanel}>
          <div
            className={`top-panel-sheet settings-page-drawer${closingGallery ? ' is-closing' : ''}`}
            style={{ background: t.panel, padding: 14, borderLeft: `0.5px solid ${t.border}`, maxWidth: 480, marginLeft: 'auto', width: '100%', height: '100%', overflowY: 'auto' }}
            onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ flex: 1, fontSize: 15, color: t.theirText }}>대화방 갤러리</div>
              <div style={{ marginRight: 10, color: t.subText, fontSize: 11 }}>{galleryItems.length}장</div>
              <button onClick={closeGalleryPanel} style={{ border: 0, borderRadius: 9, background: 'none', color: t.subText, padding: '6px 8px' }}>닫기</button>
            </div>
            {galleryItems.length === 0 ? (
              <div style={{ padding: '48px 12px', color: t.subText, fontSize: 12, textAlign: 'center' }}>아직 전송된 이미지가 없어요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {galleryGroups.map(group => (
                  <section key={group.date}>
                    <div style={{ marginBottom: 7, color: t.subText, fontSize: 11 }}>{group.date}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
                      {group.items.map(item => {
                        const index = galleryItems.findIndex(candidate => candidate.message.id === item.message.id && candidate.imageIndex === item.imageIndex)
                        return (
                          <div key={`${item.message.id}-${item.imageIndex}`} style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 8, background: t.bg }}>
                            <button
                              onClick={() => setProfilePreview({ url: item.url, urls: galleryUrls, items: galleryPreviewItems, index, name: '' })}
                              aria-label={`${group.date} 이미지 크게 보기`}
                              style={{ width: '100%', height: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer' }}>
                              <img src={item.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <button
              onClick={leaveRoom}
              disabled={isOwner}
              style={{ width: '100%', marginTop: 18, padding: '9px 12px', borderRadius: 10, border: `1px solid ${isOwner ? t.border : '#f87171'}`, background: 'none', color: isOwner ? t.subText : '#f87171', fontSize: 12, cursor: isOwner ? 'default' : 'pointer', opacity: isOwner ? 0.48 : 1 }}>
              {isOwner ? '방장은 대화방을 나갈 수 없어요' : '대화방 나가기'}
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="top-panel-backdrop" style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowSearch(false)}>
          <div className="top-panel-sheet" style={{ background: t.panel, padding: '10px 14px', borderBottom: `0.5px solid ${t.border}`, maxWidth: 480, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="대사 검색..." autoFocus style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            {searchQuery && <div style={{ marginTop: 8, fontSize: 11, color: t.subText }}>{filteredMessages.length}개 검색됨</div>}
          </div>
        </div>
      )}

      {/* 날짜 이동 패널 */}
      {showCalendar && (
        <div className="top-panel-backdrop" style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowCalendar(false)}>
          <div className="top-panel-sheet" style={{ background: t.panel, padding: '10px 14px', borderBottom: `0.5px solid ${t.border}`, maxWidth: 480, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: t.subText, marginBottom: 8 }}>날짜로 이동</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => {
                    const target = messages.find(m => new Date(m.created_at).toLocaleDateString('ko-KR') === date)
                    if (target) {
                      document.getElementById('msg-' + target.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      setShowCalendar(false)
                    }
                  }}
                  style={{ padding: '4px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${t.border}`, background: 'none', color: t.subText }}>
                  {date}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 새 메시지 알림 버튼 */}
      {newMsgAlert && (
        <div onClick={scrollToBottom} style={{ position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: t.panel, border: `1px solid ${t.border}`, color: t.theirText, padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <ArrowDown size={13} color="#fff" />새 대화
        </div>
      )}

      {/* 메시지 목록 */}
      <div ref={messageListRef} onScroll={handleScroll} className={`chat-scroll${hideScroll ? ' hide-scroll' : ''}`} style={{ position: 'relative', flex: 1, minHeight: 0, padding: `58px 10px ${showCharList && myChars.length > 0 ? 126 : 82}px`, scrollPaddingTop: 58, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', background: t.bg, transition: 'padding-bottom 210ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {filteredMessages.map((msg, messageIndex) => {
          const isMine = msg.user_id === userId
          const messageEntranceClass = msg.entrance_side === 'right' ? 'message-enter-right' : msg.entrance_side === 'left' ? 'message-enter-left' : ''
          const char = msg.characters
          const previousMessage = filteredMessages[messageIndex - 1]
          const nextMessage = filteredMessages[messageIndex + 1]
          const currentDateKey = new Date(msg.created_at).toLocaleDateString('ko-KR')
          const previousDateKey = previousMessage ? new Date(previousMessage.created_at).toLocaleDateString('ko-KR') : null
          const showDateDivider = currentDateKey !== previousDateKey
          const showUnreadDivider = msg.id === initialUnreadId
          const timelineMarkerHeight = (showDateDivider ? 30 : 0) + (showUnreadDivider ? 28 : 0)
          const timelineMarkers = timelineMarkerHeight > 0 && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: timelineMarkerHeight, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', pointerEvents: 'none' }}>
              {showDateDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ flex: 1, height: 1, background: t.border, opacity: 0.55 }} />
                  <span style={{ padding: '3px 9px', borderRadius: 10, color: t.subText, background: `${t.panel}cc`, border: `1px solid ${t.border}`, fontSize: 10 }}>{currentDateKey}</span>
                  <span style={{ flex: 1, height: 1, background: t.border, opacity: 0.55 }} />
                </div>
              )}
              {showUnreadDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: t.point, fontSize: 10, fontWeight: 600 }}>
                  <span style={{ flex: 1, height: 1, background: t.point, opacity: 0.65 }} />
                  <span>여기부터 안 읽은 메시지</span>
                  <span style={{ flex: 1, height: 1, background: t.point, opacity: 0.65 }} />
                </div>
              )}
            </div>
          )
          const showMessageIdentity =
            !previousMessage ||
            previousMessage.type === 'chapter' ||
            previousMessage.type === 'narration' ||
            previousMessage.character_id !== msg.character_id ||
            previousMessage.user_id !== msg.user_id
          const currentMinute = new Date(msg.created_at).getTime()
          const nextMinute = nextMessage ? new Date(nextMessage.created_at).getTime() : NaN
          const nextMessageHasTime = nextMessage && nextMessage.type !== 'chapter' && nextMessage.type !== 'narration'
          const showMessageTimestamp = showMessageTime && (!nextMessageHasTime || Math.floor(currentMinute / 60000) !== Math.floor(nextMinute / 60000))
          const showReadReceipt = readReceipt !== 'none' && msg.id === lastReadMessageId
          const showMessageMeta = showMessageTimestamp || showReadReceipt || Boolean(msg.delivery_state)
          const ownMessageLongPressStyle = isMine
            ? {
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }
            : {}

          if (msg.type === 'chapter')
            return (
              <div key={msg.id} id={'msg-' + msg.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: `${timelineMarkerHeight + 8}px 8px 8px` }}>
                {timelineMarkers}
                <span style={{ flex: 1, height: 1, background: t.border }} />
                <span style={{ color: t.subText, fontSize: 10 }}>{msg.content || '구분선'}</span>
                <span style={{ flex: 1, height: 1, background: t.border }} />
              </div>
            )

          if (msg.type === 'member_joined' || msg.type === 'member_left')
            return (
              <div key={msg.id} id={'msg-' + msg.id} style={{ position: 'relative', paddingTop: timelineMarkerHeight }}>
                {timelineMarkers}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', color: t.subText, fontSize: 10 }}>
                  <span style={{ flex: 1, height: 1, background: t.border, opacity: 0.55 }} />
                  <span>{msg.content}</span>
                  <span style={{ flex: 1, height: 1, background: t.border, opacity: 0.55 }} />
                </div>
              </div>
            )

          if (msg.type === 'room_invite') {
            let invite = null
            try {
              invite = JSON.parse(msg.content)
            } catch {
              invite = null
            }
            if (!invite?.roomId) return null
            const alreadyJoined = joinedRoomIds.includes(invite.roomId)
            return (
              <div key={msg.id} id={'msg-' + msg.id} style={{ position: 'relative', paddingTop: timelineMarkerHeight }}>
                {timelineMarkers}
                <div style={{ margin: '2px auto', width: 'min(88%, 330px)', padding: 12, borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, boxShadow: '0 8px 22px rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 11, background: `${t.point}22`, color: t.point }}><DoorOpen size={18} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: t.subText, fontSize: 10 }}>{alreadyJoined ? '연결된 장소' : `${msg.characters?.name || '사용자'}의 대화방 초대`}</div>
                      <div style={{ marginTop: 2, color: t.theirText, fontSize: 13, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{invite.roomName}</div>
                    </div>
                    <button onClick={() => enterInvitedRoom(invite)} style={{ flexShrink: 0, padding: '7px 11px', border: 0, borderRadius: 9, background: t.point, color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                      {alreadyJoined ? '입장' : '초대 수락'}
                    </button>
                  </div>
                </div>
              </div>
            )
          }

          if (msg.type === 'communication')
            return (
              <div key={msg.id} id={'msg-' + msg.id} style={{ position: 'relative', paddingTop: timelineMarkerHeight }}>
                {timelineMarkers}
                <CommunicationRecord message={msg} theme={t} onOpenSession={() => setShowCommunication(true)} />
              </div>
            )

          if (msg.type === 'narration')
            return (
              <div
                className={messageEntranceClass}
                onAnimationEnd={() => messageEntranceClass && finishMessageEntrance(msg.id)}
                key={msg.id}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={event => isMine && event.preventDefault()}
                onSelectStart={event => isMine && event.preventDefault()}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: `${timelineMarkerHeight + 2}px 0 2px`, touchAction: 'pan-y', ...ownMessageLongPressStyle }}>
                {timelineMarkers}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: t.narrColor }} />
                  ))}
                </div>
                {editingId === msg.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <input value={editText} onChange={event => setEditText(event.target.value)} onKeyDown={event => event.key === 'Enter' && editMessage(msg.id)} style={{ minWidth: 210, background: t.bg, border: `0.5px solid ${t.point}`, borderRadius: 8, padding: '7px 10px', color: t.inputText, fontSize: 12, outline: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${t.border}`, borderRadius: 9, overflow: 'hidden', background: t.panel, boxShadow: '0 3px 10px rgba(0,0,0,0.2)' }}>
                      <button onClick={() => editMessage(msg.id)} style={{ border: 0, background: 'none', color: t.theirText, padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>저장</button>
                      <div style={{ width: 1, alignSelf: 'stretch', background: t.border }} />
                      <button onClick={() => setEditingId(null)} style={{ border: 0, background: 'none', color: '#f87171', padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>취소</button>
                    </div>
                  </div>
                ) : (
                  msg.content.split('\n').map((line, i) => (
                    <div key={i} style={{ fontSize: 11, color: t.narrColor, fontStyle: 'italic', textAlign: 'center', padding: '0 16px', lineHeight: 1.6 }}>
                      {line}
                    </div>
                  ))
                )}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: t.narrColor }} />
                  ))}
                </div>
                {renderMessageActions(msg)}
                {renderDeliveryStatus(msg)}
              </div>
            )

          if (msg.type === 'image_group') {
            let imageUrls = []
            try {
              imageUrls = JSON.parse(msg.content)
            } catch {
              imageUrls = []
            }
            return (
              <div
                className={messageEntranceClass}
                onAnimationEnd={() => messageEntranceClass && finishMessageEntrance(msg.id)}
                key={msg.id}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={event => isMine && event.preventDefault()}
                onSelectStart={event => isMine && event.preventDefault()}
                style={{ position: 'relative', display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 6, paddingTop: timelineMarkerHeight, touchAction: 'pan-y', ...ownMessageLongPressStyle }}>
                {timelineMarkers}
                <div style={{ flexShrink: 0, width: 43, height: showMessageIdentity ? 43 : 0 }}>
                  {showMessageIdentity && <div style={{ width: 43, height: 43, overflow: 'hidden' }}><img className="squircle-media" src={talkingAvatarUrl(msg)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                  {showMessageIdentity && char?.name && <div style={{ marginBottom: 4, color: t.subText, fontSize: 11 }}>{char.name}</div>}
                  <div style={{ width: 190, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 3, overflow: 'hidden', borderRadius: 11 }}>
                    {imageUrls.map((url, imageIndex) => (
                      <img
                        key={`${url}-${imageIndex}`}
                        src={url}
                        alt=""
                        onPointerDown={event => startImageLongPress(event, msg, imageIndex)}
                        onPointerMove={moveLongPress}
                        onPointerUp={cancelLongPress}
                        onPointerCancel={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onContextMenu={event => isMine && event.preventDefault()}
                        onSelectStart={event => isMine && event.preventDefault()}
                        onClick={() => openImageMessage(url, imageUrls, imageIndex)}
                        style={{ display: 'block', width: '100%', height: 92, objectFit: 'cover', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', gridColumn: imageUrls.length % 2 === 1 && imageIndex === imageUrls.length - 1 ? '1 / -1' : undefined }}
                      />
                    ))}
                  </div>
                  {imageMenuTarget?.message.id === msg.id ? (
                    <div className="message-action-menu" data-message-menu="true" onPointerDown={event => event.stopPropagation()} style={{ display: 'flex', alignItems: 'center', marginTop: 5, border: `1px solid ${t.border}`, borderRadius: 9, overflow: 'hidden', background: t.panel, boxShadow: '0 3px 10px rgba(0,0,0,0.2)' }}>
                      <button onClick={() => deleteGalleryImage({ message: msg, imageIndex: imageMenuTarget.imageIndex })} style={{ border: 0, background: 'none', color: '#f87171', padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>삭제</button>
                    </div>
                  ) : renderMessageActions(msg, false)}
                  {renderDeliveryStatus(msg)}
                </div>
              </div>
            )
          }

          if (msg.type === 'image')
            return (
              <div
                className={messageEntranceClass}
                onAnimationEnd={() => messageEntranceClass && finishMessageEntrance(msg.id)}
                key={msg.id}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={event => isMine && event.preventDefault()}
                onSelectStart={event => isMine && event.preventDefault()}
                style={{ position: 'relative', display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 6, paddingTop: timelineMarkerHeight, touchAction: 'pan-y', ...ownMessageLongPressStyle }}>
                {timelineMarkers}
                <div style={{ flexShrink: 0, width: 43, height: showMessageIdentity ? 43 : 0 }}>
                  {showMessageIdentity && <div role="button" tabIndex={0} aria-label={`${char?.name || '프로필'} 사진 크게 보기`} onPointerDown={event => event.stopPropagation()} onClick={() => setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name })} style={{ width: 43, height: 43, background: 'transparent', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: char?.text_color || t.subText, cursor: 'zoom-in' }}><img className="squircle-media" src={talkingAvatarUrl(msg)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                  {showMessageIdentity && char?.name && <div style={{ maxWidth: '100%', marginBottom: 4, color: t.subText, fontSize: 11, lineHeight: 1.35, overflowWrap: 'anywhere', textAlign: isMine ? 'right' : 'left' }}>{char.name}</div>}
                  <img src={msg.content} style={{ maxWidth: 180, borderRadius: 10, cursor: 'pointer' }} onClick={() => openImageMessage(msg.content)} />
                  {showMessageTimestamp && <div style={{ fontSize: 10, color: t.subText, marginTop: 2, opacity: 0.72 }}>{new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>}
                  {renderMessageActions(msg, false)}
                  {renderDeliveryStatus(msg)}
                </div>
              </div>
            )

          const bubbleBg = isMine ? t.myBubble : t.theirBubble
          const bubbleColor = isMine ? t.myText : t.theirText
          const actColor = isMine ? t.myAct : t.subText

          return (
              <div
              className={messageEntranceClass}
              onAnimationEnd={() => messageEntranceClass && finishMessageEntrance(msg.id)}
              key={msg.id}
              id={'msg-' + msg.id}
              onPointerDown={event => startLongPress(event, msg)}
              onPointerMove={moveLongPress}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={event => isMine && event.preventDefault()}
              onSelectStart={event => isMine && event.preventDefault()}
              style={{ position: 'relative', display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 6, paddingTop: timelineMarkerHeight, touchAction: 'pan-y', ...ownMessageLongPressStyle }}>
              {timelineMarkers}
              <div style={{ flexShrink: 0, width: 43, height: showMessageIdentity ? 43 : 0 }}>
                {showMessageIdentity && <div role="button" tabIndex={0} aria-label={`${char?.name || '프로필'} 사진 크게 보기`} onPointerDown={event => event.stopPropagation()} onClick={() => setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name })} style={{ width: 43, height: 43, background: 'transparent', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: char?.text_color || t.subText, cursor: 'zoom-in' }}><img className="squircle-media" src={talkingAvatarUrl(msg)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                {showMessageIdentity && char?.name && <div style={{ maxWidth: '100%', marginBottom: 4, color: t.subText, fontSize: 11, lineHeight: 1.35, overflowWrap: 'anywhere', textAlign: isMine ? 'right' : 'left' }}>{char.name}</div>}
                {editingId === msg.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 5 }}>
                    <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && editMessage(msg.id)} style={{ width: 'min(62vw, 280px)', background: t.bg, border: `0.5px solid ${t.point}`, borderRadius: 8, padding: '7px 10px', color: t.inputText, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${t.border}`, borderRadius: 9, overflow: 'hidden', background: t.panel, boxShadow: '0 3px 10px rgba(0,0,0,0.2)' }}>
                      <button onClick={() => editMessage(msg.id)} style={{ border: 0, background: 'none', color: t.theirText, padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>저장</button>
                      <div style={{ width: 1, alignSelf: 'stretch', background: t.border }} />
                      <button onClick={() => setEditingId(null)} style={{ border: 0, background: 'none', color: '#f87171', padding: '7px 13px', fontSize: 11, cursor: 'pointer' }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div
                    data-message-bubble
                    style={{ background: bubbleBg, color: bubbleColor, padding: '8px 12px', borderRadius: 13, fontSize: 'calc(14px * var(--idea-font-scale, 1))', lineHeight: 1.55, border: 'none', cursor: isMine ? 'pointer' : 'default' }}>
                    {parseContent(msg.content, actColor, actionStyle)}
                    {msg.edited && showEditedLabel && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>수정됨</span>}
                  </div>
                )}
                {renderMessageActions(msg)}
                {showMessageMeta && <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  {showReadReceipt && <Eye size={10} color={t.subText} opacity={0.4} />}
                  {showMessageTimestamp && <div style={{ fontSize: 10, color: t.subText, opacity: 0.72 }}>{searchQuery ? new Date(msg.created_at).toLocaleDateString('ko-KR') + ' ' + new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>}
                  {renderDeliveryStatus(msg)}
                </div>}
              </div>
            </div>
          )
        })}

        {/* 입력중 표시 */}
        {showTypingIndicator && typingInfo && typingInfo.expiresAt > Date.now() && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '2px 0' }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.subText, opacity: 0.6, animation: 'typing-dot 1.2s infinite', animationDelay: '0s' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.subText, opacity: 0.6, animation: 'typing-dot 1.2s infinite', animationDelay: '0.2s' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.subText, opacity: 0.6, animation: 'typing-dot 1.2s infinite', animationDelay: '0.4s' }} />
            </div>
            <span style={{ fontSize: 11, color: t.subText, opacity: 0.7 }}>
              {typingInfo.charName}
              {subjectParticle(typingInfo.charName)} 말하는 중...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15, padding: '8px 10px calc(10px + env(safe-area-inset-bottom))', touchAction: 'none', pointerEvents: 'none' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-34px 0 0',
            background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, ${t.bg} 30%, transparent) 34%, color-mix(in srgb, ${t.bg} 82%, transparent) 100%)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 34%, #000 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 34%, #000 100%)',
            pointerEvents: 'none',
          }}
        />
        {myChars.length > 0 && (
          <button
            onMouseDown={e => e.preventDefault()}
            onPointerDown={event => {
              profileGestureStartRef.current = event.clientY
              profileGestureHandledRef.current = false
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }}
            onPointerMove={event => {
              if (profileGestureStartRef.current === null || profileGestureHandledRef.current) return
              const distance = profileGestureStartRef.current - event.clientY
              if (distance > 24) {
                profileGestureHandledRef.current = true
                openCharList()
              } else if (distance < -24) {
                profileGestureHandledRef.current = true
                closeCharList()
              }
            }}
            onPointerUp={event => {
              profileGestureStartRef.current = null
              event.currentTarget.releasePointerCapture?.(event.pointerId)
            }}
            onPointerCancel={() => {
              profileGestureStartRef.current = null
              profileGestureHandledRef.current = false
            }}
            onClick={() => {
              if (profileGestureHandledRef.current) {
                profileGestureHandledRef.current = false
                return
              }
              if (showCharList) closeCharList()
              else openCharList()
            }}
            aria-label="프로필 변경 메뉴"
            style={{ position: 'absolute', top: -18, left: 14, background: `color-mix(in srgb, ${t.panel} 78%, transparent)`, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '3px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', touchAction: 'none' }}>
            {showCharList ? <ChevronDown size={13} color={t.subText} /> : <ChevronUp size={13} color={t.subText} />}
          </button>
        )}
        {myChars.length > 0 && showCharList && (
          <div className={`profile-picker-reveal${closingCharList ? ' is-closing' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, marginBottom: 7, padding: '7px 9px', borderRadius: 14, background: `color-mix(in srgb, ${t.panel} 76%, transparent)`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', pointerEvents: closingCharList ? 'none' : 'auto' }}>
            <span style={{ fontSize: 10, color: t.subText, flexShrink: 0 }}>나</span>
            <div className="character-strip" style={{ display: 'flex', gap: 5, flex: 1, minWidth: 0, flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', touchAction: 'pan-x', paddingBottom: 2 }}>
              {myChars.map(c => (
                <button
                  key={c.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={async () => {
                    setActiveChar(c)
                    setMode('chat')
                    const {
                      data: { user },
                    } = await supabase.auth.getUser()
                    await supabase.from('room_members').update({ last_char_id: c.id }).eq('room_id', roomId).eq('user_id', user.id)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '3px 8px 3px 4px', borderRadius: 20, border: activeChar?.id === c.id && mode === 'chat' ? `1.5px solid ${c.color || t.point}` : `1px solid ${t.border}`, background: activeChar?.id === c.id && mode === 'chat' ? c.color + '22' : 'none', cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, background: c.color || t.point, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: c.text_color || '#fff', overflow: 'hidden', flexShrink: 0 }}><img className="squircle-media" src={c.image_url || DEFAULT_AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                  <span style={{ fontSize: 11, color: activeChar?.id === c.id && mode === 'chat' ? t.theirText : t.subText }}>{c.name}</span>
                </button>
              ))}
            </div>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => navigate(`/room/${roomId}/characters`)}
              style={{ flexShrink: 0, background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '4px 7px', color: t.subText, fontSize: 10, cursor: 'pointer' }}>
              설정
            </button>
          </div>
        )}
        {myChars.length === 0 && (
          <button onClick={() => navigate('/characters')} style={{ width: '100%', background: `color-mix(in srgb, ${t.panel} 76%, transparent)`, backdropFilter: 'blur(16px)', border: `0.5px dashed ${t.border}`, borderRadius: 12, padding: '8px', color: t.subText, fontSize: 12, cursor: 'pointer', marginBottom: 8, pointerEvents: 'auto' }}>
            + 캐릭터 추가하기
          </button>
        )}
        {showRoleplayMenu && (
          <div className={`roleplay-tool-menu${closingRoleplayMenu ? ' is-closing' : ''}`} style={{ display: 'grid', gap: 6, marginBottom: 7, padding: 8, borderRadius: 14, background: `color-mix(in srgb, ${t.panel} 92%, transparent)`, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: `1px solid ${t.border}`, pointerEvents: closingRoleplayMenu ? 'none' : 'auto' }}>
            <button
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                setMode(isNarrActive ? 'chat' : 'narration')
                closeRoleplayMenu()
                inputRef.current?.focus()
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: `1px solid ${isNarrActive ? t.point : t.border}`, background: isNarrActive ? `${t.point}22` : 'none', color: isNarrActive ? t.point : t.theirText }}>
              <Quote size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>나레이션</span>
              <span style={{ fontSize: 10, color: t.subText }}>{isNarrActive ? '사용 중' : '전환'}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Minus size={16} color={t.subText} style={{ flexShrink: 0 }} />
              <input
                value={dividerText}
                onChange={event => setDividerText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    sendDivider()
                  }
                }}
                placeholder="구분선 문구"
                style={{ flex: 1, minWidth: 0, padding: '8px 9px', borderRadius: 9, border: `1px solid ${t.border}`, background: t.bg, color: t.inputText, outline: 'none' }}
              />
              <button onMouseDown={event => event.preventDefault()} onClick={sendDivider} style={{ flexShrink: 0, padding: '8px 11px', borderRadius: 9, border: 0, background: t.point, color: '#fff' }}>
                추가
              </button>
            </div>
            <button
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                closeRoleplayMenu()
                setShowCommunication(true)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'none', color: t.theirText }}>
              <Phone size={16} />
              <MessageSquare size={16} />
              <span>전화 · 문자</span>
            </button>
            <button
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                closeRoleplayMenu()
                setShowBackgroundAudio(true)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'none', color: t.theirText }}>
              <Music size={16} />
              <span>공유 배경음</span>
            </button>
            <button
              onMouseDown={event => event.preventDefault()}
              onClick={loadInvitableRooms}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'none', color: t.theirText }}>
              <DoorOpen size={16} />
              <span>다른 방으로 초대</span>
            </button>
            {showRoomInvitePicker && (
              <div style={{ display: 'grid', gap: 5, paddingTop: 2 }}>
                <div style={{ color: t.subText, fontSize: 10 }}>초대할 방을 선택하세요.</div>
                {invitableRooms.length === 0 ? (
                  <div style={{ padding: 9, borderRadius: 9, background: t.bg, color: t.subText, fontSize: 11, textAlign: 'center' }}>초대할 수 있는 다른 방이 없어요.</div>
                ) : (
                  invitableRooms.map(targetRoom => (
                    <button key={targetRoom.id} onMouseDown={event => event.preventDefault()} onClick={() => sendRoomInvite(targetRoom)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1px solid ${t.border}`, background: t.bg, color: t.theirText, textAlign: 'left' }}>
                      <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{targetRoom.name}</span>
                      <Send size={13} color={t.point} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%', height: 42, padding: 5, borderRadius: 22, background: `color-mix(in srgb, ${t.panel} 78%, transparent)`, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: `1px solid ${t.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.24)', pointerEvents: 'auto' }}>
          <button onMouseDown={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()} aria-label="이미지 업로드" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: `${t.border}88`, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paperclip size={16} color={t.subText} />
          </button>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" ref={fileInputRef} onChange={e => sendImages(e.target.files)} style={{ display: 'none' }} />
          <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                handleTyping(e)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              onFocus={() => {
                ;[0, 140, 320].forEach(delay => {
                  window.setTimeout(() => {
                    if (window.visualViewport) {
                      setViewportHeight(window.visualViewport.height)
                      setViewportOffsetTop(window.visualViewport.offsetTop)
                    }
                    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
                  }, delay)
                })
              }}
              placeholder={isNarrActive ? '나레이션 입력...' : activeChar ? `${activeChar.name}${instrumentalParticle(activeChar.name)} 입력...` : '캐릭터를 먼저 추가해주세요'}
              enterKeyHint="enter"
              rows={1}
              style={{ flex: 1, minWidth: 0, height: 32, minHeight: 32, maxHeight: 32, overflowY: 'auto', background: 'transparent', border: 'none', borderRadius: 0, padding: '5px 6px', color: isNarrActive ? t.narrColor : t.inputText, fontSize: 'calc(14px * var(--idea-font-scale, 1))', outline: 'none', resize: 'none', lineHeight: 1.55, fontStyle: isNarrActive ? 'italic' : 'normal' }}
            />
            {myChars.length > 0 && (
              <button onMouseDown={e => e.preventDefault()} onClick={() => { if (showRoleplayMenu) closeRoleplayMenu(); else openRoleplayMenu() }} aria-label="역극 편의기능 메뉴" style={{ width: 32, height: 32, flexShrink: 0, padding: 0, borderRadius: '50%', cursor: 'pointer', border: `1px solid ${showRoleplayMenu || isNarrActive ? t.point : 'transparent'}`, background: showRoleplayMenu || isNarrActive ? `${t.point}2f` : `${t.border}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} color={showRoleplayMenu || isNarrActive ? t.narrColor : t.subText} />
              </button>
            )}
          <button onMouseDown={e => e.preventDefault()} onClick={sendMessage} aria-label="전송" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: t.point, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUp size={18} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <style>{`
            @keyframes slide-in-right {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            @keyframes typing-dot {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                30% { transform: translateY(-4px); opacity: 1; }
            }
            `}</style>
    </div>
  )
}
