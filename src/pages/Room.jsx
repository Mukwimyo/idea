import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, uploadFile, validateImageFile } from '../lib/supabase'
import { DEFAULT_THEME_ID, THEMES, getTheme } from '../lib/themes'
import { useThemeVars } from '../lib/themeVars'
import { prefersReducedMotion } from '../lib/motion'
import { ChevronLeft, ChevronRight, Settings, Search, Images, ArrowUp, Eye, ArrowDown, ChevronDown, ChevronUp, Quote, RotateCcw, AlertCircle, Minus, Phone, Copy, DoorOpen, Send, Music, Grid2X2, ImagePlus, Star, Bookmark, MapPin, StickyNote, Dices, Crown, Percent, Scissors, Shuffle, Sparkles, UserRound, UsersRound, X } from 'lucide-react'
import ProfileImageModal from '../components/ProfileImageModal'
import CommunicationSessions from '../components/CommunicationSessions'
import CommunicationRecord from '../components/CommunicationRecord'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import LoadingScreen from '../components/LoadingScreen'
import EntryCharacterPicker from '../components/EntryCharacterPicker'
import SharedBackgroundAudio from '../components/SharedBackgroundAudio'
import RoomWorldPanel from '../components/RoomWorldPanel'
import RandomTools from '../components/RandomTools'
import ConfirmDialog from '../components/ConfirmDialog'
import { Button, Card, IconButton, TextArea, TextInput, Toggle } from '../components/ui'
import QuickToolPicker from '../components/QuickToolPicker'
import { MessageEffectBubble, MessageEffectChip, MessageEffectPicker } from '../components/MessageEffects'
import AnimatedMessageText from '../components/AnimatedMessageText'
import { normalizeTextEffectSettings, textEffectDurationMs } from '../features/messages/textEffectSettings'
import useConfirmDialog from '../hooks/useConfirmDialog'
import useMessageStageEffects from '../hooks/useMessageStageEffects'
import {
  advanceRoomReadCursor,
  createClientMessageId,
  fetchRoomMessages,
  fetchRoomReadCursors,
  hydrateMessageCharacter,
  joinRoomWithInvite,
  sendRoomMessage as sendRoomMessageRpc,
} from '../features/messages/messageApi'
import { highestReadableMessage, mergeMessages, messageRenderKey } from '../features/messages/messageState'
import { readQuickToolPreferences, toggleFavoriteTool, writeQuickToolPreferences } from '../features/rooms/quickToolPreferences'
import {
  queuePendingMessage,
  readPendingMessages,
  removePendingMessage,
  migrateLegacyPendingMessages,
} from '../features/messages/pendingMessageStore'

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

function SlotEntrance({ roomName, onDone }) {
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
      div.className = 'room-slot__item'
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
              s.classList.add('room-slot__item--selected')
            } else if (dist === 1) {
              s.classList.add('room-slot__item--adjacent')
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
    <div className="room-slot" style={{ '--room-slot-item-height': `${ITEM_H}px`, '--room-slot-window-height': `${WINDOW_H}px` }}>
      <div className="room-slot__status">ENTERING{dots}</div>
      <div className="room-slot__divider" />
      <div className="room-slot__window">
        <div ref={reelRef} className="room-slot__reel" />
      </div>
      <div className="room-slot__divider" />
    </div>
  )
}

function normalizeActionSize(value) {
  return value === 'large' ? 'large' : 'small'
}

function parseContent(text, actionSize) {
  const parts = []
  const re = /(\([^)]*\)?)/g
  let last = 0,
    m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>)
    parts.push(
      <span key={m.index} className={actionSize === 'large' ? 'message-action-text message-action-text--large' : 'message-action-text'}>
        {m[0]}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>)
  return parts
}

function MessageSendingStatus({ sending }) {
  const [visible, setVisible] = useState(sending)
  if (sending && !visible) setVisible(true)
  if (!visible) return null

  return (
    <div
      className="message-sending"
      data-exiting={!sending}
      aria-hidden={!sending}
      onAnimationEnd={event => {
        if (event.target !== event.currentTarget || event.animationName !== 'message-sending-out') return
        event.stopPropagation()
        if (!sending) setVisible(false)
      }}>
      <div className="message-sending__clip">
        <span className="message-sending__label">전송 중…</span>
      </div>
    </div>
  )
}

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const { confirmation, confirm, closeConfirmation } = useConfirmDialog()
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [input, setInput] = useState(() => localStorage.getItem(`idea-room-draft:${roomId}`) || '')
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
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [closingBookmarks, setClosingBookmarks] = useState(false)
  const [topCharacterPickerEnabled, setTopCharacterPickerEnabled] = useState(false)
  const [showTopCharacterPicker, setShowTopCharacterPicker] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableDates, setAvailableDates] = useState([])
  const [readReceipt, setReadReceipt] = useState('text')
  const [actionSize, setActionSize] = useState('small')
  const [theme, setTheme] = useState(null)
  const [sharedThemeId, setSharedThemeId] = useState(DEFAULT_THEME_ID)
  const [followShared, setFollowShared] = useState(true)
  const [myThemeId, setMyThemeId] = useState(() => localStorage.getItem('idea-theme-id') || DEFAULT_THEME_ID)
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
  const [hideMessageBubbles, setHideMessageBubbles] = useState(false)
  const [messageMenuId, setMessageMenuId] = useState(null)
  const [imageMenuTarget, setImageMenuTarget] = useState(null)
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState(() => new Set())
  const [profilePreview, setProfilePreview] = useState(null)
  const [showCommunication, setShowCommunication] = useState(false)
  const [showBackgroundAudio, setShowBackgroundAudio] = useState(false)
  const [worldPanelTab, setWorldPanelTab] = useState(null)
  const [showRandomTools, setShowRandomTools] = useState(false)
  const [showRoleplayMenu, setShowRoleplayMenu] = useState(false)
  const [closingRoleplayMenu, setClosingRoleplayMenu] = useState(false)
  const [toolSheetOffset, setToolSheetOffset] = useState(0)
  const [draggingToolSheet, setDraggingToolSheet] = useState(false)
  const [quickToolPreferences, setQuickToolPreferences] = useState(() => readQuickToolPreferences(window.localStorage))
  const [showQuickToolPicker, setShowQuickToolPicker] = useState(false)
  const [showSendActionMenu, setShowSendActionMenu] = useState(false)
  const [toolPanel, setToolPanel] = useState(null)
  const [selectedMessageEffect, setSelectedMessageEffect] = useState(null)
  const [showRoomInvitePicker, setShowRoomInvitePicker] = useState(false)
  const [invitableRooms, setInvitableRooms] = useState([])
  const [joinedRoomIds, setJoinedRoomIds] = useState([])
  const [pendingInviteEntry, setPendingInviteEntry] = useState(null)
  const [entryCharacters, setEntryCharacters] = useState([])
  const [entryJoining, setEntryJoining] = useState(false)
  const [dividerText, setDividerText] = useState('')
  const [initialUnreadId, setInitialUnreadId] = useState(null)
  const [readCursors, setReadCursors] = useState([])
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
  const quickToolGestureRef = useRef(null)
  const quickToolGestureHandledRef = useRef(false)
  const sendPressTimerRef = useRef(null)
  const sendPressStartRef = useRef(null)
  const sendPressTriggeredRef = useRef(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const messageListRef = useRef(null)
  const initialScrollDone = useRef(false)
  const channelRef = useRef(null)
  const userIdRef = useRef(null)
  const messagesRef = useRef([])
  const reconcilingMessagesRef = useRef(false)
  const reconcileRequestedRef = useRef(false)
  const fetchMessagesRef = useRef(null)
  const refreshReadCursorsRef = useRef(null)
  const markAsReadRef = useRef(null)
  const loadTalkingFramesRef = useRef(null)
  const persistMessageRef = useRef(null)
  const toolSheetDragRef = useRef({ pointerId: null, startY: 0, lastY: 0, startedAt: 0 })
  const roomStageRef = useRef(null)
  const playMessageStageEffect = useMessageStageEffects(roomStageRef)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const key = `idea-room-draft:${roomId}`
      if (input) localStorage.setItem(key, input)
      else localStorage.removeItem(key)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [input, roomId])

  useEffect(() => {
    if (!typingInfo?.characterId) {
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

  const closeBookmarksPanel = callback => {
    if (closingBookmarks) return
    setClosingBookmarks(true)
    window.setTimeout(() => {
      setShowBookmarks(false)
      setClosingBookmarks(false)
      callback?.()
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

  const chooseCharacter = async character => {
    setActiveChar(character)
    setMode('chat')
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('room_members').update({ last_char_id: character.id }).eq('room_id', roomId).eq('user_id', user.id)
    }
  }

  const preserveComposerFocus = event => {
    if (document.activeElement === inputRef.current) event.preventDefault()
  }

  const toggleTopCharacterPicker = () => {
    const nextOpen = !showTopCharacterPicker
    setShowTopCharacterPicker(nextOpen)
    if (nextOpen) {
      setShowSearch(false)
      setShowGallery(false)
      setShowTheme(false)
      if (showBookmarks) closeBookmarksPanel()
    }
  }

  const openRoleplayMenu = ({ preserveComposerFocus = false } = {}) => {
    if (!preserveComposerFocus) inputRef.current?.blur()
    setToolSheetOffset(0)
    setClosingRoleplayMenu(false)
    setShowRoleplayMenu(true)
  }

  const closeRoleplayMenu = () => {
    if (!showRoleplayMenu || closingRoleplayMenu) return
    setDraggingToolSheet(false)
    setToolSheetOffset(0)
    setClosingRoleplayMenu(true)
    window.setTimeout(() => {
      setShowRoleplayMenu(false)
      setClosingRoleplayMenu(false)
      setShowRoomInvitePicker(false)
      setToolPanel(null)
    }, 190)
  }

  const startToolSheetDrag = event => {
    toolSheetDragRef.current = { pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, startedAt: performance.now() }
    setDraggingToolSheet(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveToolSheetDrag = event => {
    if (toolSheetDragRef.current.pointerId !== event.pointerId) return
    toolSheetDragRef.current.lastY = event.clientY
    setToolSheetOffset(Math.max(0, event.clientY - toolSheetDragRef.current.startY))
  }

  const finishToolSheetDrag = event => {
    if (toolSheetDragRef.current.pointerId !== event.pointerId) return
    const distance = Math.max(0, toolSheetDragRef.current.lastY - toolSheetDragRef.current.startY)
    const elapsed = Math.max(1, performance.now() - toolSheetDragRef.current.startedAt)
    const fastDownwardFlick = distance > 28 && distance / elapsed > 0.45
    toolSheetDragRef.current.pointerId = null
    setDraggingToolSheet(false)
    if (distance >= 72 || fastDownwardFlick) closeRoleplayMenu()
    else setToolSheetOffset(0)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user.id)
      userIdRef.current = user.id
      migrateLegacyPendingMessages(localStorage, user.id)
      const { data: bookmarks } = await supabase.from('message_bookmarks').select('message_id').eq('user_id', user.id).eq('room_id', roomId)
      setBookmarkedMessageIds(new Set((bookmarks || []).map(bookmark => bookmark.message_id)))
      await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
      const { data: ownMemberships } = await supabase.from('room_members').select('room_id').eq('user_id', user.id)
      setJoinedRoomIds((ownMemberships || []).map(member => member.room_id))

      const { data: roomData } = await supabase.from('rooms').select().eq('id', roomId).single()
      setRoom(roomData)
      setReadReceipt(roomData?.read_receipt_style || 'text')
      setActionSize(normalizeActionSize(roomData?.action_style))
      setShowTypingIndicator(roomData?.show_typing_indicator ?? true)
      setIsOwner(roomData?.created_by === user.id)

      const [{ data: profile }, { data: messageDisplaySetting }] = await Promise.all([
        supabase.from('profiles').select('theme_id, last_char_id, show_entering').eq('id', user.id).single(),
        supabase.from('profiles').select('show_message_time, show_edited_label, top_character_picker, hide_message_bubbles').eq('id', user.id).maybeSingle(),
      ])
      const enteringEnabled = profile?.show_entering ?? true
      setShowEntering(enteringEnabled)
      setShowMessageTime(messageDisplaySetting?.show_message_time ?? true)
      setShowEditedLabel(messageDisplaySetting?.show_edited_label ?? true)
      setTopCharacterPickerEnabled(messageDisplaySetting?.top_character_picker ?? false)
      setHideMessageBubbles(messageDisplaySetting?.hide_message_bubbles ?? false)
      if (!enteringEnabled) setShowSlot(false)
      const myId = profile?.theme_id || DEFAULT_THEME_ID
      setMyThemeId(myId)

      const sharedId = roomData?.shared_theme_id || DEFAULT_THEME_ID
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
              setTalkingFrameIndex(0)
              setTypingInfo({ charName: payload.new.typing_char_name, characterId, expiresAt })
              if (characterId) loadTalkingFramesRef.current?.(characterId)
              remoteTypingTimerRef.current = window.setTimeout(() => setTypingInfo(null), remaining)
            } else {
              setTypingInfo(null)
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, async payload => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new
            let hydrated = newMsg
            try {
              hydrated = await hydrateMessageCharacter(supabase, newMsg)
            } catch (error) {
              console.warn('message character hydration failed:', error.message)
            }
            const fullMsg = { ...hydrated, entrance_side: newMsg.user_id === userIdRef.current ? null : 'left' }
            setMessages(prev => mergeMessages(prev, fullMsg))
            if (!isAtBottomRef.current) setNewMsgAlert(true)
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => mergeMessages(prev, payload.new))
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_read_cursors', filter: `room_id=eq.${roomId}` }, payload => {
          if (payload.eventType === 'DELETE') {
            setReadCursors(current => current.filter(cursor => cursor.user_id !== payload.old.user_id))
            return
          }
          setReadCursors(current => {
            const withoutUser = current.filter(cursor => cursor.user_id !== payload.new.user_id)
            return [...withoutUser, payload.new]
          })
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') fetchMessagesRef.current?.()
        })

      await fetchMessagesRef.current?.()
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
    if (!showSendActionMenu) return undefined
    const closeSendActionMenu = event => {
      if (event.target.closest?.('[data-send-action-menu="true"]')) return
      setShowSendActionMenu(false)
    }
    document.addEventListener('pointerdown', closeSendActionMenu)
    return () => document.removeEventListener('pointerdown', closeSendActionMenu)
  }, [showSendActionMenu])

  useEffect(() => () => window.clearTimeout(sendPressTimerRef.current), [])

  useEffect(() => {
    if (isAtBottomRef.current) {
      const behavior =
        messages.length > 0 && !initialScrollDone.current
          ? 'instant'
          : prefersReducedMotion()
            ? 'auto'
            : 'smooth'
      messagesEndRef.current?.scrollIntoView({ behavior })
      initialScrollDone.current = true
      window.requestAnimationFrame(() => markAsReadRef.current?.(messages))
    }
  }, [messages])

  useEffect(() => {
    const handleFocus = () => fetchMessagesRef.current?.()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMessagesRef.current?.()
    }
    const cursorHeartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshReadCursorsRef.current?.()
    }, 15_000)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(cursorHeartbeat)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    setNewMsgAlert(false)
    isAtBottomRef.current = true
    markAsRead(messagesRef.current)
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

  const refreshReadCursors = async () => {
    try {
      const cursors = await fetchRoomReadCursors(supabase, roomId)
      setReadCursors(cursors)
    } catch (error) {
      console.warn('read cursor reconciliation failed:', error.message)
    }
  }

  const fetchMessages = async () => {
    if (reconcilingMessagesRef.current) {
      reconcileRequestedRef.current = true
      return
    }

    reconcilingMessagesRef.current = true
    try {
      const [messagePage, cursors] = await Promise.all([
        fetchRoomMessages(supabase, roomId),
        fetchRoomReadCursors(supabase, roomId),
      ])
      const data = messagePage.messages
      const ownCursor = cursors.find(cursor => cursor.user_id === userIdRef.current)
      if (!initialScrollDone.current && userIdRef.current) {
        const firstUnread = data.find(
          message =>
            message.user_id !== userIdRef.current &&
            message.type !== 'chapter' &&
            Number(message.sequence_no) > Number(ownCursor?.last_read_sequence || 0)
        )
        setInitialUnreadId(firstUnread?.id || null)
      }
      window.clearTimeout(remoteTypingTimerRef.current)
      setMessages(current => mergeMessages(current, data))
      setHasOlderMessages(messagePage.hasMore)
      setReadCursors(cursors)
      const dates = [...new Set(data.map(m => new Date(m.created_at).toLocaleDateString('ko-KR')))]
      setAvailableDates(dates)
    } catch (error) {
      console.error('message reconciliation failed:', error.message)
    } finally {
      reconcilingMessagesRef.current = false
      if (reconcileRequestedRef.current) {
        reconcileRequestedRef.current = false
        queueMicrotask(fetchMessages)
      }
    }
  }

  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasOlderMessages) return
    const oldestSequence = messagesRef.current.find(message => Number.isFinite(Number(message.sequence_no)))?.sequence_no
    if (oldestSequence == null) return

    const list = messageListRef.current
    const previousScrollHeight = list?.scrollHeight || 0
    const previousScrollTop = list?.scrollTop || 0
    setLoadingOlderMessages(true)
    try {
      const page = await fetchRoomMessages(supabase, roomId, { beforeSequence: oldestSequence })
      setMessages(current => mergeMessages(current, page.messages))
      setHasOlderMessages(page.hasMore)
      setAvailableDates(current => [
        ...new Set([
          ...page.messages.map(message => new Date(message.created_at).toLocaleDateString('ko-KR')),
          ...current,
        ]),
      ])
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!list) return
          list.scrollTop = previousScrollTop + (list.scrollHeight - previousScrollHeight)
        })
      })
    } catch (error) {
      console.error('older message fetch failed:', error.message)
      showToast('이전 메시지를 불러오지 못했습니다.')
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  const markAsRead = async msgs => {
    if (
      !userIdRef.current ||
      document.visibilityState !== 'visible' ||
      !document.hasFocus() ||
      !isAtBottomRef.current
    ) return

    const target = highestReadableMessage(msgs)
    if (!target) return
    const ownCursor = readCursors.find(cursor => cursor.user_id === userIdRef.current)
    if (Number(ownCursor?.last_read_sequence || 0) >= Number(target.sequence_no)) return

    try {
      const cursor = await advanceRoomReadCursor(supabase, roomId, target.id)
      if (!cursor) return
      setReadCursors(current => {
        const withoutUser = current.filter(item => item.user_id !== cursor.user_id)
        return [...withoutUser, cursor]
      })
    } catch (error) {
      console.warn('read cursor update failed:', error.message)
    }
  }

  const handleTyping = async e => {
    const isNarration = mode === 'narration'
    if (!showTypingIndicator || (!activeChar && !isNarration) || !userIdRef.current) return
    const hasContent = e.target.value.trim().length > 0
    const currentTime = Date.now()
    const shouldRefresh = hasContent && currentTime - lastTypingSentAtRef.current >= 2000

    if (shouldRefresh) {
      lastTypingSentAtRef.current = currentTime
      await supabase
        .from('room_members')
        .update({
          is_typing: true,
          typing_char_name: isNarration ? '나레이션' : activeChar.name,
          typing_character_id: isNarration ? null : activeChar.id,
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
    const clientMessageId = message.client_message_id || createClientMessageId()
    const durableMessage = { ...message, client_message_id: clientMessageId }
    setMessages(prev =>
      prev.map(m =>
        m.id === tempId
          ? { ...m, client_message_id: clientMessageId, delivery_state: 'sending' }
          : m
      )
    )
    try {
      const persisted = await sendRoomMessageRpc(supabase, durableMessage)
      setMessages(prev => mergeMessages(prev, persisted))
      removePendingMessage(localStorage, userIdRef.current, clientMessageId)
      return true
    } catch (error) {
      console.error('message insert failed:', error.message)
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, delivery_state: 'failed' } : m)))
      queuePendingMessage(localStorage, userIdRef.current, {
        tempId,
        message: durableMessage,
        roomId,
      })
      return false
    }
  }

  const retryMessage = msg =>
    persistMessage(msg.id, {
      room_id: msg.room_id,
      user_id: msg.user_id,
      character_id: msg.character_id,
      type: msg.type,
      content: msg.content,
      effect_key: msg.effect_key || null,
      client_message_id: msg.client_message_id,
    })

  useEffect(() => {
    const retryPending = async () => {
      if (!navigator.onLine) return
      if (!userId) return
      const queue = readPendingMessages(localStorage, userId).filter(item => item.roomId === roomId)
      for (const item of queue) {
        const existing = messagesRef.current.find(message => message.id === item.tempId)
        if (!existing) {
          setMessages(current => mergeMessages(current, { ...item.message, id: item.tempId, created_at: new Date(item.queuedAt).toISOString(), delivery_state: 'failed' }))
        }
        await persistMessageRef.current?.(item.tempId, item.message)
      }
    }
    window.addEventListener('online', retryPending)
    retryPending()
    return () => window.removeEventListener('online', retryPending)
  }, [roomId, userId])

  useLayoutEffect(() => {
  fetchMessagesRef.current = fetchMessages
  refreshReadCursorsRef.current = refreshReadCursors
    markAsReadRef.current = markAsRead
    loadTalkingFramesRef.current = loadTalkingFrames
    persistMessageRef.current = persistMessage
  })

  useLayoutEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    const resizeComposer = () => {
      const scrollTop = textarea.scrollTop
      textarea.style.height = '34px'
      textarea.style.height = `${textarea.scrollHeight}px`
      textarea.scrollTop = scrollTop
    }

    resizeComposer()
    window.addEventListener('resize', resizeComposer)
    return () => window.removeEventListener('resize', resizeComposer)
  }, [input, theme])

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
    const effectKey = selectedMessageEffect
    if (isNarr && messages.length > 0) {
      const last = messages[messages.length - 1]
      if (!effectKey && !last.effect_key && last.type === 'narration' && last.user_id === user.id) {
        const merged = last.content + '\n' + content
        setMessages(prev => prev.map(m => (m.id === last.id ? { ...m, content: merged } : m)))
        inputRef.current?.focus()
        await supabase.from('messages').update({ content: merged }).eq('id', last.id)
        return
      }
    }

    const clientMessageId = createClientMessageId()
    const tempMsg = {
      id: 'temp-' + Date.now(),
      client_message_id: clientMessageId,
      room_id: roomId,
      user_id: user.id,
      character_id: isNarr ? null : activeChar?.id,
      characters: activeChar ? { name: activeChar.name, color: activeChar.color, text_color: activeChar.text_color, avatar_letter: activeChar.avatar_letter, image_url: activeChar.image_url } : null,
      type: isNarr ? 'narration' : 'chat',
      content,
      effect_key: effectKey,
      text_effect_settings: normalizeTextEffectSettings(isNarr ? null : activeChar?.text_effect_settings),
      edited: false,
      created_at: new Date().toISOString(),
      delivery_state: 'sending',
      entrance_side: 'right',
    }
    isAtBottomRef.current = true
    setMessages(prev => [...prev, tempMsg])
    setSelectedMessageEffect(null)
    if (mode === 'narration') setMode('chat')
    inputRef.current?.focus()
    await persistMessage(tempMsg.id, {
      room_id: roomId,
      user_id: user.id,
      character_id: isNarr ? null : activeChar?.id,
      type: isNarr ? 'narration' : 'chat',
      content,
      effect_key: effectKey,
      client_message_id: clientMessageId,
    })
  }

  const editMessage = async id => {
    if (!editText.trim()) return
    const { error } = await supabase.from('messages').update({ content: editText.trim(), edited: true }).eq('id', id).eq('user_id', userId)
    if (error) {
      showToast('메시지를 수정하지 못했어요.', 'error')
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
    if (!(await confirm({ title: '메시지를 삭제할까요?', description: '삭제한 메시지는 되돌릴 수 없어요.', confirmLabel: '삭제', danger: true }))) return
    setMessageMenuId(null)
    setDeletingMessageId(msg.id)
    const { error } = await supabase.from('messages').delete().eq('id', msg.id).eq('user_id', userId)
    setDeletingMessageId(null)
    if (error) {
      showToast('메시지를 삭제하지 못했어요.', 'error')
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

    let urls
    try {
      urls = JSON.parse(message.content)
    } catch {
      return
    }
    if (!(await confirm({ title: '이미지를 삭제할까요?', description: '대화에서 이미지가 영구적으로 제거돼요.', confirmLabel: '삭제', danger: true }))) return
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
      showToast('이미지를 삭제하지 못했어요.', 'error')
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

  const startSendButtonPress = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    window.clearTimeout(sendPressTimerRef.current)
    sendPressTriggeredRef.current = false
    sendPressStartRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    sendPressTimerRef.current = window.setTimeout(() => {
      sendPressTriggeredRef.current = true
      setShowQuickToolPicker(false)
      setShowSendActionMenu(true)
      sendPressTimerRef.current = null
    }, 500)
  }

  const moveSendButtonPress = event => {
    const start = sendPressStartRef.current
    if (!start || sendPressTriggeredRef.current) return
    if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) {
      window.clearTimeout(sendPressTimerRef.current)
      sendPressTimerRef.current = null
      sendPressStartRef.current = null
    }
  }

  const finishSendButtonPress = event => {
    window.clearTimeout(sendPressTimerRef.current)
    sendPressTimerRef.current = null
    sendPressStartRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelSendButtonPress = () => {
    window.clearTimeout(sendPressTimerRef.current)
    sendPressTimerRef.current = null
    sendPressStartRef.current = null
    sendPressTriggeredRef.current = false
  }

  const handleSendButtonClick = () => {
    if (sendPressTriggeredRef.current) {
      sendPressTriggeredRef.current = false
      return
    }
    setShowSendActionMenu(false)
    setShowQuickToolPicker(false)
    sendMessage()
  }

  const openMessageEffectPicker = () => {
    setShowSendActionMenu(false)
    setShowQuickToolPicker(false)
    setToolPanel('effects')
    openRoleplayMenu({ preserveComposerFocus: true })
  }

  const startLongPress = (event, msg) => {
    if (msg.id.toString().startsWith('temp-')) return
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

  const allowMessageEffectReplay = () => {
    if (!longPressTriggeredRef.current) return true
    longPressTriggeredRef.current = false
    return false
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
    if (!(await confirm({ title: '대화방에서 나갈까요?', description: '다시 참여하려면 초대 코드가 필요해요.', confirmLabel: '나가기', danger: true }))) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const leavingCharacter = activeChar || myChars[0]
    const leavingName = leavingCharacter?.name || '사용자'
    try {
      await sendRoomMessageRpc(supabase, {
        room_id: roomId,
        client_message_id: createClientMessageId(),
        character_id: leavingCharacter?.id || null,
        type: 'member_left',
        content: `${leavingName}님이 대화방에서 나갔어요.`,
      })
    } catch (messageError) {
      console.warn('leave message could not be recorded:', messageError.message)
    }
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
      showToast(validationError, 'error')
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
    const { data, error } = await supabase.from('room_members').select('room_id, rooms(id, name, invite_code)').eq('user_id', user.id)
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
    const content = JSON.stringify({ roomId: targetRoom.id, roomName: targetRoom.name, inviteCode: targetRoom.invite_code })
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
    if (!pendingInviteEntry.inviteCode) {
      showToast('이전 방식의 초대예요. 방 초대 코드를 받아 입장해주세요.', 'error')
      return
    }
    setEntryJoining(true)
    try {
      await joinRoomWithInvite(
        supabase,
        pendingInviteEntry.inviteCode,
        character.id,
        createClientMessageId()
      )
    } catch (error) {
      console.warn('invited room join failed:', error.message)
      setEntryJoining(false)
      showToast('방 초대를 수락하지 못했어요.', 'error')
      return
    }
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
      showToast(invalid, 'error')
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

  const toggleMessageBookmark = async msg => {
    const isBookmarked = bookmarkedMessageIds.has(msg.id)
    setMessageMenuId(null)
    setBookmarkedMessageIds(current => {
      const next = new Set(current)
      if (isBookmarked) next.delete(msg.id)
      else next.add(msg.id)
      return next
    })
    const query = isBookmarked
      ? supabase.from('message_bookmarks').delete().eq('user_id', userId).eq('message_id', msg.id)
      : supabase.from('message_bookmarks').insert({ user_id: userId, room_id: roomId, message_id: msg.id })
    const { error } = await query
    if (error) {
      setBookmarkedMessageIds(current => {
        const next = new Set(current)
        if (isBookmarked) next.add(msg.id)
        else next.delete(msg.id)
        return next
      })
      showToast('북마크를 저장하지 못했어요.', 'error')
      return
    }
    showToast(isBookmarked ? '북마크를 해제했어요.' : '중요 대사로 북마크했어요.')
  }

  const shareRandomResult = async result => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !result) return
    const tempId = `temp-random-${Date.now()}`
    const content = JSON.stringify(result)
    const tempMessage = {
      id: tempId,
      room_id: roomId,
      user_id: user.id,
      character_id: activeChar?.id || null,
      characters: activeChar || null,
      type: 'random_result',
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
      type: 'random_result',
      content,
    })
  }

  const quickTool = quickToolPreferences.activeId
  const favoriteTools = quickToolPreferences.favorites

  const saveQuickToolPreferences = nextPreferences => {
    const saved = writeQuickToolPreferences(window.localStorage, nextPreferences)
    setQuickToolPreferences(saved)
    return saved
  }

  const toggleQuickToolFavorite = toolId => {
    const next = toggleFavoriteTool(quickToolPreferences, toolId)
    if (!next.changed) {
      showToast('빠른 실행 도구는 하나 이상 남겨주세요.')
      return
    }
    const wasFavorite = favoriteTools.includes(toolId)
    saveQuickToolPreferences(next)
    showToast(wasFavorite ? '즐겨찾기에서 해제했어요.' : '즐겨찾기에 추가했어요.')
  }

  const selectQuickTool = toolId => {
    if (!favoriteTools.includes(toolId)) return
    saveQuickToolPreferences({ activeId: toolId, favorites: favoriteTools })
    setShowQuickToolPicker(false)
  }

  const runRoomTool = async (toolId, fromQuickButton = false) => {
    if (toolId === 'image') {
      if (showRoleplayMenu) closeRoleplayMenu()
      window.setTimeout(() => fileInputRef.current?.click(), showRoleplayMenu ? 200 : 0)
      return
    }
    if (toolId === 'narration') {
      setMode(isNarrActive ? 'chat' : 'narration')
      if (showRoleplayMenu) closeRoleplayMenu()
      window.setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    if (toolId === 'divider') {
      setToolPanel('divider')
      if (fromQuickButton && !showRoleplayMenu) openRoleplayMenu()
      return
    }
    if (toolId === 'effects') {
      setToolPanel('effects')
      if (fromQuickButton && !showRoleplayMenu) openRoleplayMenu({ preserveComposerFocus: true })
      return
    }
    if (toolId === 'communication') {
      if (showRoleplayMenu) closeRoleplayMenu()
      setShowCommunication(true)
      return
    }
    if (toolId === 'audio') {
      if (showRoleplayMenu) closeRoleplayMenu()
      setShowBackgroundAudio(true)
      return
    }
    if (toolId === 'invite') {
      if (fromQuickButton && !showRoleplayMenu) openRoleplayMenu()
      await loadInvitableRooms()
      return
    }
    if (toolId === 'locations' || toolId === 'notes') {
      if (showRoleplayMenu) closeRoleplayMenu()
      setWorldPanelTab(toolId)
      return
    }
    if (toolId === 'random') {
      if (showRoleplayMenu) closeRoleplayMenu()
      setShowRandomTools(true)
      return
    }
    if (toolId === 'bookmarks') {
      if (showRoleplayMenu) closeRoleplayMenu()
      setShowSearch(false)
      setShowGallery(false)
      setShowTheme(false)
      setClosingBookmarks(false)
      setShowBookmarks(true)
    }
  }

  const t = theme || getTheme(DEFAULT_THEME_ID)
  useThemeVars(theme)

  const roomTools = [
    { id: 'image', label: '이미지', icon: ImagePlus },
    { id: 'narration', label: '나레이션', icon: Quote },
    { id: 'divider', label: '구분선', icon: Minus },
    { id: 'effects', label: '대사 연출', icon: Sparkles },
    { id: 'communication', label: '전화·문자', icon: Phone },
    { id: 'audio', label: '공유 배경음', icon: Music },
    { id: 'invite', label: '다른 방 초대', icon: DoorOpen },
    { id: 'locations', label: '장소·장면', icon: MapPin },
    { id: 'notes', label: '공유 메모', icon: StickyNote },
    { id: 'random', label: '랜덤 도구', icon: Dices },
    { id: 'bookmarks', label: '중요 대사', icon: Bookmark },
  ]
  const roomToolGroups = [
    { id: 'conversation', label: '대화', tools: ['image', 'narration', 'divider', 'communication'] },
    { id: 'direction', label: '연출', tools: ['effects', 'audio', 'locations', 'random'] },
    { id: 'room', label: '방 관리', tools: ['invite', 'notes', 'bookmarks'] },
  ]
  const selectedQuickTool = roomTools.find(tool => tool.id === quickTool) || roomTools[1]
  const favoriteRoomTools = favoriteTools.map(toolId => roomTools.find(tool => tool.id === toolId)).filter(Boolean)

  const renderMessageActions = (msg, canEdit = true) => {
    if (messageMenuId !== msg.id) return null
    const isMine = msg.user_id === userId
    const isBookmarked = bookmarkedMessageIds.has(msg.id)
    return (
      <div
        className="message-action-menu message-controls"
        data-message-menu="true"
        onPointerDown={event => event.stopPropagation()}>
        <Button variant="ghost" className={isBookmarked ? 'message-control--bookmarked' : undefined} onClick={() => toggleMessageBookmark(msg)}>
          <Bookmark size={12} fill={isBookmarked ? 'currentColor' : 'none'} />
          {isBookmarked ? '해제' : '북마크'}
        </Button>
        {isMine && <div className="message-control-divider" />}
        {isMine && canEdit && (
          <>
            <Button variant="ghost" onClick={() => startEditingMessage(msg)}>
              수정
            </Button>
            <div className="message-control-divider" />
          </>
        )}
        {isMine && (
          <Button variant="ghost" className="message-control--danger" disabled={deletingMessageId === msg.id} onClick={() => deleteMessage(msg)}>
            삭제
          </Button>
        )}
      </div>
    )
  }
  const renderDeliveryStatus = msg => {
    if (msg.delivery_state === 'uploading') {
      const progress = Math.max(0, Math.min(100, msg.upload_progress || 0))
      return (
        <div className="message-upload">
          <div className="message-upload__label">업로드 중 {progress}%</div>
          <div className="message-upload__track">
            <div className="message-upload__progress" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )
    }
    if (msg.delivery_state === 'upload_failed') return <span className="message-upload-failed">파일 업로드 실패</span>
    if (msg.delivery_state !== 'failed') return <MessageSendingStatus sending={msg.delivery_state === 'sending'} />
    return (
      <Button
        variant="ghost"
        onClick={() => retryMessage(msg)}
        className="message-retry">
        <AlertCircle size={12} />
        전송 실패
        <RotateCcw size={12} />
        다시 시도
      </Button>
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
  const bookmarkedMessages = messages.filter(message => bookmarkedMessageIds.has(message.id)).slice().reverse()
  const bookmarkPreview = message => {
    if (message.type === 'image') return '이미지'
    if (message.type === 'image_group') return '여러 장의 이미지'
    if (message.type === 'scene_transition') {
      try {
        return `장면 전환 · ${JSON.parse(message.content).name}`
      } catch {
        return '장면 전환'
      }
    }
    if (message.type === 'communication') return '전화·문자 기록'
    return message.content || '내용 없는 메시지'
  }
  const jumpToBookmarkedMessage = messageId => {
    closeBookmarksPanel(() => {
      const target = document.getElementById(`msg-${messageId}`)
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
      target?.classList.add('bookmark-jump-highlight')
      window.setTimeout(() => target?.classList.remove('bookmark-jump-highlight'), 1500)
    })
  }
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
  const lastReadMessage = [...filteredMessages].reverse().find(
    message =>
      message.user_id === userId &&
      Number.isFinite(Number(message.sequence_no)) &&
      readCursors.some(
        cursor =>
          cursor.user_id !== userId &&
          Number(cursor.last_read_sequence) >= Number(message.sequence_no)
      )
  )
  const lastReadMessageId = lastReadMessage?.id
  const lastReadCount = lastReadMessage
    ? readCursors.filter(
        cursor =>
          cursor.user_id !== userId &&
          Number(cursor.last_read_sequence) >= Number(lastReadMessage.sequence_no)
      ).length
    : 0

  if (!theme)
    return <LoadingScreen />

  return (
    <div
      ref={roomStageRef}
      className={!showEntering ? 'room-stage room-stage--slide-in' : 'room-stage'}
      style={{ top: viewportOffsetTop, height: viewportHeight }}>
      <Toast toast={toast} />
      <ConfirmDialog
        open={Boolean(confirmation)}
        theme={t}
        {...confirmation}
        onConfirm={() => closeConfirmation(true)}
        onCancel={() => closeConfirmation(false)}
      />
      <EntryCharacterPicker
        open={Boolean(pendingInviteEntry)}
        roomName={pendingInviteEntry?.roomName}
        characters={entryCharacters}
        theme={t}
        loading={entryJoining}
        onSelect={completeInvitedRoomEntry}
        onClose={() => !entryJoining && setPendingInviteEntry(null)}
      />
      <ProfileImageModal profile={profilePreview} onClose={() => setProfilePreview(null)} onEdit={profilePreview?.characterId ? () => navigate(`/characters/${profilePreview.characterId}/edit`) : null} />
      <CommunicationSessions roomId={roomId} userId={userId} myChars={myChars} theme={t} open={showCommunication} onClose={() => setShowCommunication(false)} />
      <SharedBackgroundAudio roomId={roomId} userId={userId} theme={t} open={showBackgroundAudio} onClose={() => setShowBackgroundAudio(false)} />
      {worldPanelTab && <RoomWorldPanel open initialTab={worldPanelTab} roomId={roomId} userId={userId} activeCharacter={activeChar} theme={t} onClose={() => setWorldPanelTab(null)} />}
      <RandomTools open={showRandomTools} roomId={roomId} theme={t} onClose={() => setShowRandomTools(false)} onShare={shareRandomResult} />
      {showSlot && room && showEntering && (
        <SlotEntrance
          roomName={room.name}
          onDone={() => {
            setShowSlot(false)
          }}
        />
      )}

      {/* 헤더 */}
      <div className="room-header">
        <div aria-hidden="true" className="room-header__backdrop" />
        <IconButton className="room-header__button" label="채팅방 목록으로 돌아가기" onClick={() => navigate('/')}>
          <ChevronLeft size={22} />
        </IconButton>
        {!(topCharacterPickerEnabled && showTopCharacterPicker) && (
          <div className="room-header__title">{room?.name}</div>
        )}
        {topCharacterPickerEnabled && showTopCharacterPicker ? (
          <div role="group" aria-label="캐릭터 선택" className="character-strip room-header__characters">
            {myChars.length ? myChars.map(character => {
              const selected = activeChar?.id === character.id && mode === 'chat'
              return (
                <IconButton
                  key={character.id}
                  className="room-header__button room-header__character"
                  onMouseDown={event => event.preventDefault()}
                  onPointerDown={preserveComposerFocus}
                  onClick={() => chooseCharacter(character)}
                  label={`${character.name} 선택`}
                  aria-pressed={selected}
                  title={character.name}>
                  <span className="room-header__avatar" style={{ backgroundColor: character.color || undefined }}>
                    <img src={character.image_url || DEFAULT_AVATAR} alt="" />
                  </span>
                </IconButton>
              )
            }) : <span className="room-header__caption">캐릭터 없음</span>}
          </div>
        ) : <>
          <IconButton className="room-header__button" label="대화 검색" active={showSearch} onClick={() => openPanel(showSearch ? null : 'search')}>
            <Search size={15} />
          </IconButton>
          <IconButton
            className="room-header__button"
            label="대화방 갤러리"
            active={showGallery}
            onClick={() => (showGallery ? closeGalleryPanel() : openPanel('gallery'))}>
            <Images size={15} />
          </IconButton>
          {!topCharacterPickerEnabled && <IconButton
            className="room-header__button"
            label="중요 대사 북마크"
            active={showBookmarks}
            onClick={() => {
              if (showBookmarks) closeBookmarksPanel()
              else {
                setShowSearch(false)
                setShowGallery(false)
                setShowTheme(false)
                setClosingBookmarks(false)
                setShowBookmarks(true)
              }
            }}>
            <Bookmark size={15} fill={showBookmarks ? 'currentColor' : 'none'} />
          </IconButton>}
          {topCharacterPickerEnabled && !showTopCharacterPicker && <IconButton
            className="room-header__button"
            label="캐릭터 선택"
            onClick={toggleTopCharacterPicker}
            onPointerDown={preserveComposerFocus}
            aria-expanded={false}>
            <UserRound size={17} />
          </IconButton>}
          <IconButton
            className="room-header__button"
            label="채팅방 설정"
            active={showTheme}
            onClick={() => (showTheme ? closeThemePanel() : openPanel('theme'))}>
            <Settings size={15} />
          </IconButton>
        </>}
        {topCharacterPickerEnabled && showTopCharacterPicker && <IconButton
          className="room-header__button"
          label="캐릭터 목록 닫기"
          active
          onClick={toggleTopCharacterPicker}
          onPointerDown={preserveComposerFocus}
          aria-expanded={true}>
          <UserRound size={17} />
        </IconButton>}
      </div>

      {/* 초대 코드 패널 */}
      {showInvite && (
        <div className="top-panel-backdrop" onClick={() => setShowInvite(false)}>
          <div className="top-panel-sheet room-invite-panel" onClick={e => e.stopPropagation()}>
            <div className="top-panel-caption">초대 코드</div>
            <Button variant="ghost" className="room-invite-code room-invite-code--large" onClick={copyInviteCode}>
              <span>{room?.invite_code}</span>
              <Copy size={15} />
            </Button>
            <div className="top-panel-caption room-invite-panel__hint">상대방에게 이 코드를 알려주세요</div>
          </div>
        </div>
      )}

      {/* 테마 패널 */}
      {showTheme && (
        <div className={`top-panel-backdrop top-panel-backdrop--drawer${closingTheme ? ' is-closing' : ''}`} onClick={closeThemePanel}>
          <div className="top-panel-sheet top-panel-sheet--drawer room-settings-panel" onClick={e => e.stopPropagation()}>
            <div className="top-panel-heading room-settings-panel__heading">
              <div className="top-panel-heading__text">
                <div className="top-panel-title">대화방 설정</div>
                <div className="top-panel-caption room-settings-panel__room-name">{room?.name}</div>
              </div>
              <IconButton className="room-settings-panel__close" onClick={closeThemePanel} label="설정 닫기"><X size={17} /></IconButton>
            </div>
            <Card className="room-settings-panel__invite">
              <div className="top-panel-caption">초대 코드</div>
              <Button variant="ghost" className="room-invite-code" onClick={copyInviteCode}>
                {room?.invite_code}
                <Copy size={13} />
              </Button>
            </Card>
            <div className="room-settings-panel__actions">
              <Button
                variant="secondary"
                onClick={() => {
                  closeThemePanel()
                  setShowCalendar(true)
                }}>
                날짜로 이동
              </Button>
              <Button variant="secondary" onClick={exportChat}>
                채팅 내보내기
              </Button>
            </div>
            <Button variant="secondary" block className="room-settings-panel__characters" onClick={() => { closeThemePanel(); navigate(`/room/${roomId}/characters`) }}>
              <span className="room-settings-panel__characters-icon"><UsersRound size={17} /></span>
              <span className="top-panel-heading__text">
                <span className="room-settings-panel__characters-title">방 캐릭터 목록</span>
                <span className="top-panel-caption room-settings-panel__help">이 방에서 사용할 캐릭터와 순서를 관리해요.</span>
              </span>
              <ChevronRight size={16} className="room-settings-panel__chevron" />
            </Button>
            <div className="top-panel-caption room-settings-panel__section-title">화면과 대화</div>
            <Card className="room-settings-panel__row room-settings-panel__row--follow">
              <div>
                <div className="room-settings-panel__label">공유 테마 따라가기</div>
                <div className="top-panel-caption room-settings-panel__help">방장이 설정한 테마로 보기</div>
              </div>
              <Toggle label="공유 테마 따라가기" checked={followShared} onChange={toggleFollow} />
            </Card>
            {isOwner && (
              <div className="room-settings-panel__themes">
                <div className="top-panel-caption room-settings-panel__themes-title">
                  공유 테마 <span>(방장만 변경 가능)</span>
                </div>
                <div className="room-settings-panel__theme-list">
                  {THEMES.map(th => (
                    <Button
                      key={th.id}
                      variant="ghost"
                      className="room-theme-preview"
                      aria-pressed={sharedThemeId === th.id}
                      onClick={() => saveSharedTheme(th.id)}>
                      <span className="room-theme-preview__sample" style={{ borderColor: sharedThemeId === th.id ? th.point : `color-mix(in srgb, ${th.border} 65%, transparent)` }}>
                        <span className="room-theme-preview__header" style={{ background: th.panel, borderColor: th.border }} />
                        <span className="room-theme-preview__conversation" style={{ background: th.bg }}>
                          <span className="room-theme-preview__bubble room-theme-preview__bubble--their" style={{ background: th.theirBubble, borderColor: th.theirBorder }} />
                          <span className="room-theme-preview__bubble room-theme-preview__bubble--mine" style={{ background: th.myBubble }} />
                        </span>
                      </span>
                      <span style={{ color: sharedThemeId === th.id ? th.point : undefined }}>{th.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <Card className="room-settings-panel__row">
              <div className="room-settings-panel__label room-settings-panel__choice-label">읽음 확인</div>
              <div className="room-settings-panel__choices">
                {['text', 'number', 'none'].map(s => (
                  <Button
                    key={s}
                    variant="ghost"
                    size="sm"
                    className="room-settings-panel__choice"
                    aria-pressed={readReceipt === s}
                    onClick={async () => {
                      setReadReceipt(s)
                      const { error } = await supabase.from('rooms').update({ read_receipt_style: s }).eq('id', roomId)
                      showToast(error ? '읽음 확인 설정을 저장하지 못했어요.' : '읽음 확인 설정이 저장됐어요.', error ? 'error' : 'success')
                    }}>
                    {s === 'text' ? '읽음' : s === 'number' ? '1' : '없음'}
                  </Button>
                ))}
              </div>
            </Card>
            <Card className="room-settings-panel__row">
              <div className="room-settings-panel__label room-settings-panel__choice-label">지문 크기</div>
              <div className="room-settings-panel__choices">
                {[
                  { val: 'small', label: '작게' },
                  { val: 'large', label: '크게' },
                ].map(s => (
                  <Button
                    key={s.val}
                    variant="ghost"
                    size="sm"
                    className="room-settings-panel__choice"
                    aria-pressed={actionSize === s.val}
                    onClick={async () => {
                      setActionSize(s.val)
                      const { error } = await supabase.from('rooms').update({ action_style: s.val }).eq('id', roomId)
                      showToast(error ? '지문 크기를 저장하지 못했어요.' : '지문 크기가 저장됐어요.', error ? 'error' : 'success')
                    }}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </Card>
            <Card className="room-settings-panel__row">
              <div>
                <div className="room-settings-panel__label">입력 중 표시</div>
                <div className="top-panel-caption room-settings-panel__help">{isOwner ? '이 방에서 작성 중 상태를 표시합니다.' : '방장만 변경할 수 있습니다.'}</div>
              </div>
              <Toggle
                disabled={!isOwner}
                label="입력 중 표시 전환"
                checked={showTypingIndicator}
                className="room-settings-panel__typing-switch"
                onChange={async next => {
                  if (!isOwner) return
                  setShowTypingIndicator(next)
                  if (!next) setTypingInfo(null)
                  const { error } = await supabase.from('rooms').update({ show_typing_indicator: next }).eq('id', roomId)
                  if (error) setShowTypingIndicator(!next)
                  showToast(error ? '입력 중 표시 설정을 저장하지 못했어요.' : '입력 중 표시 설정이 저장됐어요.', error ? 'error' : 'success')
                }}
              />
            </Card>
            {isOwner && (
              <div className="room-settings-panel__owner">
                <div className="room-settings-panel__label room-settings-panel__field-label">방 이름</div>
                <div className="room-settings-panel__field">
                  <TextInput className="room-settings-panel__name-input" value={roomNameText} onChange={e => setRoomNameText(e.target.value)} onFocus={() => setRoomNameText(room?.name || '')} onKeyDown={e => e.key === 'Enter' && saveRoomName()} placeholder={room?.name} />
                  <Button size="sm" onClick={saveRoomName}>
                    저장
                  </Button>
                </div>
                <div className="room-settings-panel__cover-field">
                  <div className="room-settings-panel__label room-settings-panel__field-label">대표 이미지</div>
                  <div className="room-settings-panel__field">
                    <div className="squircle-media room-settings-panel__cover">{room?.cover_image ? <img src={room.cover_image} alt="" /> : '✦'}</div>
                    <label className="room-settings-panel__file-label">
                      이미지 선택
                      <input
                        type="file"
                        accept="image/*"
                        hidden
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
                      <Button
                        variant="secondary"
                        size="sm"
                        className="room-settings-panel__delete-cover"
                        onClick={async () => {
                          await supabase.from('rooms').update({ cover_image: null }).eq('id', roomId)
                          setRoom(prev => ({ ...prev, cover_image: null }))
                        }}>
                        삭제
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 북마크 패널 */}
      {showBookmarks && (
        <div
          className={`top-panel-backdrop top-panel-backdrop--drawer${closingBookmarks ? ' is-closing' : ''}`}
          onClick={() => closeBookmarksPanel()}>
          <div className="top-panel-sheet top-panel-sheet--drawer" onClick={event => event.stopPropagation()}>
            <div className="top-panel-heading">
              <div className="top-panel-title top-panel-heading__text">중요 대사 북마크</div>
              <div className="top-panel-caption">{bookmarkedMessages.length}개</div>
              <Button variant="ghost" size="sm" className="top-panel-close" onClick={() => closeBookmarksPanel()}>닫기</Button>
            </div>
            {bookmarkedMessages.length === 0 ? (
              <div className="top-panel-empty">
                아직 북마크한 메시지가 없어요.<br />메시지를 꾹 눌러 중요 대사로 저장할 수 있어요.
              </div>
            ) : (
              <div className="room-bookmarks">
                {bookmarkedMessages.map(message => (
                  <Card key={message.id} className="room-bookmarks__item">
                    <Button variant="ghost" className="room-bookmarks__jump" onClick={() => jumpToBookmarkedMessage(message.id)}>
                      <span className="top-panel-caption room-bookmarks__meta">
                        <span>{message.type === 'narration' ? '나레이션' : message.characters?.name || '기록'}</span>
                        <span>{new Date(message.created_at).toLocaleDateString('ko-KR')}</span>
                      </span>
                      <span className="room-bookmarks__preview">{bookmarkPreview(message)}</span>
                    </Button>
                    <IconButton className="room-bookmarks__remove" onClick={() => toggleMessageBookmark(message)} label="북마크 해제">
                      <Bookmark size={15} fill="currentColor" />
                    </IconButton>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 갤러리 패널 */}
      {showGallery && (
        <div
          className={`top-panel-backdrop top-panel-backdrop--drawer${closingGallery ? ' is-closing' : ''}`}
          onClick={closeGalleryPanel}>
          <div className="top-panel-sheet top-panel-sheet--drawer" onClick={event => event.stopPropagation()}>
            <div className="top-panel-heading">
              <div className="top-panel-title top-panel-heading__text">대화방 갤러리</div>
              <div className="top-panel-caption">{galleryItems.length}장</div>
              <Button variant="ghost" size="sm" className="top-panel-close" onClick={closeGalleryPanel}>닫기</Button>
            </div>
            {galleryItems.length === 0 ? (
              <div className="top-panel-empty">아직 전송된 이미지가 없어요.</div>
            ) : (
              <div className="room-gallery">
                {galleryGroups.map(group => (
                  <section key={group.date}>
                    <div className="top-panel-caption room-gallery__date">{group.date}</div>
                    <div className="room-gallery__images">
                      {group.items.map(item => {
                        const index = galleryItems.findIndex(candidate => candidate.message.id === item.message.id && candidate.imageIndex === item.imageIndex)
                        return (
                          <Button
                            key={`${item.message.id}-${item.imageIndex}`}
                            variant="ghost"
                            className="room-gallery__image"
                            onClick={() => setProfilePreview({ url: item.url, urls: galleryUrls, items: galleryPreviewItems, index, name: '' })}
                            aria-label={`${group.date} 이미지 크게 보기`}>
                            <img src={item.url} alt="" loading="lazy" />
                          </Button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              block
              className="room-gallery__leave"
              onClick={leaveRoom}
              disabled={isOwner}>
              {isOwner ? '방장은 대화방을 나갈 수 없어요' : '대화방 나가기'}
            </Button>
          </div>
        </div>
      )}

      {/* 검색 패널 */}
      {showSearch && (
        <div className="top-panel-backdrop" onClick={() => setShowSearch(false)}>
          <div className="top-panel-sheet" onClick={e => e.stopPropagation()}>
            <TextInput className="room-search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="대사 검색..." autoFocus />
            {searchQuery && <div className="top-panel-caption room-search-count">{filteredMessages.length}개 검색됨</div>}
          </div>
        </div>
      )}

      {/* 날짜 이동 패널 */}
      {showCalendar && (
        <div className="top-panel-backdrop" onClick={() => setShowCalendar(false)}>
          <div className="top-panel-sheet" onClick={e => e.stopPropagation()}>
            <div className="top-panel-caption">날짜로 이동</div>
            <div className="room-calendar-dates">
              {availableDates.map(date => (
                <Button
                  key={date}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const target = messages.find(m => new Date(m.created_at).toLocaleDateString('ko-KR') === date)
                    if (target) {
                      document.getElementById('msg-' + target.id)?.scrollIntoView({
                        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                        block: 'center',
                      })
                      setShowCalendar(false)
                    }
                  }}>
                  {date}
                </Button>
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
      <div
        ref={messageListRef}
        onScroll={handleScroll}
        className={`chat-scroll${hideScroll ? ' hide-scroll' : ''}${showCharList && myChars.length > 0 ? ' chat-scroll--with-characters' : ''}`}
        style={{ backgroundImage: `url("${import.meta.env.BASE_URL}branding/idea-logo-background-tile-light.png")` }}>
        {hasOlderMessages && (
          <Button
            variant="secondary"
            onClick={loadOlderMessages}
            disabled={loadingOlderMessages}
            className="message-load-older">
            {loadingOlderMessages ? '불러오는 중…' : '이전 메시지 불러오기'}
          </Button>
        )}
        {filteredMessages.map((msg, messageIndex) => {
          const isMine = msg.user_id === userId
          const renderKey = messageRenderKey(msg)
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
            <div className="message-timeline" style={{ height: timelineMarkerHeight }}>
              {showDateDivider && (
                <div className="message-divider">
                  <span className="message-divider__line" />
                  <span className="message-divider__date">{currentDateKey}</span>
                  <span className="message-divider__line" />
                </div>
              )}
              {showUnreadDivider && (
                <div className="message-divider message-divider--unread">
                  <span className="message-divider__line" />
                  <span>여기부터 안 읽은 메시지</span>
                  <span className="message-divider__line" />
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
          const hasOtherDeliveryStatus = Boolean(msg.delivery_state) && msg.delivery_state !== 'sending'
          const showMessageMeta = showMessageTimestamp || showReadReceipt || hasOtherDeliveryStatus
          const ownMessageLongPressStyle = isMine
            ? {
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }
            : {}

          if (msg.type === 'chapter')
            return (
              <div key={renderKey} id={'msg-' + msg.id} className="message-divider message-divider--chapter" style={{ paddingTop: `calc(${timelineMarkerHeight}px + var(--sp-2))` }}>
                {timelineMarkers}
                <span className="message-divider__line" />
                <span>{msg.content || '구분선'}</span>
                <span className="message-divider__line" />
              </div>
            )

          if (msg.type === 'scene_transition') {
            const scene = (() => {
              try {
                return JSON.parse(msg.content)
              } catch {
                return { name: msg.content, description: '' }
              }
            })()
            return (
              <div
                key={renderKey}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={event => event.preventDefault()}
                onSelectStart={event => event.preventDefault()}
                className="message-scene"
                style={{ paddingTop: `calc(${timelineMarkerHeight}px + var(--sp-2))` }}>
                {timelineMarkers}
                <Card className="message-card message-scene__card">
                  <div className="message-scene__stripe" />
                  <div className="message-card__row message-scene__body">
                    <div className="message-card__icon message-scene__icon"><MapPin size={19} /></div>
                    <div className="message-card__details">
                      <div className="message-card__caption message-scene__caption">SCENE CHANGE</div>
                      <div className="message-scene__name">{scene?.name || '새로운 장소'}</div>
                      {scene?.description && <div className="message-card__caption message-scene__description">{scene.description}</div>}
                    </div>
                  </div>
                </Card>
                <div className="message-actions-centered">{renderMessageActions(msg, false)}</div>
              </div>
            )
          }

          if (msg.type === 'random_result') {
            const result = (() => {
              try { return JSON.parse(msg.content) } catch { return null }
            })()
            if (!result) return null
            const ResultIcon = result.kind === 'king' ? Crown : result.kind === 'chance' ? Percent : result.kind === 'character' ? Shuffle : result.kind === 'rps' ? Scissors : Dices
            const title = result.kind === 'king' ? '왕게임' : result.kind === 'chance' ? '성공·실패' : result.kind === 'character' ? '캐릭터 추첨' : result.kind === 'rps' ? '가위바위보' : `D6 × ${result.diceCount || result.rolls?.length || 1}`
            return (
              <div
                key={renderKey}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={event => event.preventDefault()}
                onSelectStart={event => event.preventDefault()}
                className="message-result"
                style={{ paddingTop: `calc(${timelineMarkerHeight}px + var(--sp-1))` }}>
                {timelineMarkers}
                <Card className="message-card message-result__card">
                  <div className="message-card__row message-result__header">
                    <ResultIcon size={17} />
                    <strong className="message-card__details">{title}</strong>
                    <span className="message-card__caption">{msg.characters?.name || '기록'}</span>
                  </div>
                  {result.kind === 'dice' && (
                    <div className="message-result__details">
                      <div className="message-result__items">
                        {(result.rolls || []).map((roll, index) => <span key={index} className="message-result__roll">{roll}</span>)}
                      </div>
                      <div className="message-card__caption message-result__total">합계 <strong>{result.total}</strong></div>
                    </div>
                  )}
                  {result.kind === 'chance' && (
                    <div className="message-result__feature">
                      <strong className={result.success ? 'message-result__success' : 'message-result__failure'}>{result.success ? '성공' : '실패'}</strong>
                    </div>
                  )}
                  {result.kind === 'character' && (
                    <div className="message-card__row message-result__feature message-result__character">
                      <img src={result.character?.image_url || DEFAULT_AVATAR} alt="" className="squircle-media" />
                      <strong>{result.character?.name}</strong>
                    </div>
                  )}
                  {result.kind === 'king' && (
                    <div className="message-result__details">
                      <div className="message-card__row message-result__king">
                        <Crown size={17} />
                        <strong>왕 · {result.king?.name}</strong>
                      </div>
                      <div className="message-result__items message-result__assignments">
                        {(result.assignments || []).map(item => <span key={item.number} className="message-result__chip"><b>{item.number}번</b> {item.character?.name}</span>)}
                      </div>
                      {result.command && <div className="message-result__command">{result.command}</div>}
                    </div>
                  )}
                  {result.kind === 'rps' && (
                    <div className="message-result__details">
                      <div className="message-result__items">
                        {(result.plays || []).map(play => <span key={play.character?.id} className="message-result__chip"><b>{play.character?.name}</b> · {play.hand}</span>)}
                      </div>
                      <div className={result.winners?.length ? 'message-result__outcome message-result__outcome--winner' : 'message-result__outcome'}>
                        {result.winners?.length ? `승자 · ${result.winners.map(character => character.name).join(', ')}` : '무승부'}
                      </div>
                    </div>
                  )}
                </Card>
                <div className="message-actions-centered">{renderMessageActions(msg, false)}</div>
                {renderDeliveryStatus(msg)}
              </div>
            )
          }

          if (msg.type === 'member_joined' || msg.type === 'member_left')
            return (
              <div key={renderKey} id={'msg-' + msg.id} className="message-row" style={{ paddingTop: timelineMarkerHeight }}>
                {timelineMarkers}
                <div className="message-divider message-divider--membership">
                  <span className="message-divider__line" />
                  <span>{msg.content}</span>
                  <span className="message-divider__line" />
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
              <div key={renderKey} id={'msg-' + msg.id} className="message-row" style={{ paddingTop: timelineMarkerHeight }}>
                {timelineMarkers}
                <Card className="message-card message-invite">
                  <div className="message-card__row">
                    <div className="message-card__icon"><DoorOpen size={18} /></div>
                    <div className="message-card__details">
                      <div className="message-card__caption">{alreadyJoined ? '연결된 장소' : `${msg.characters?.name || '사용자'}의 대화방 초대`}</div>
                      <div className="message-invite__name">{invite.roomName}</div>
                    </div>
                    <Button className="message-invite__button" onClick={() => enterInvitedRoom(invite)}>
                      {alreadyJoined ? '입장' : '초대 수락'}
                    </Button>
                  </div>
                </Card>
              </div>
            )
          }

          if (msg.type === 'communication')
            return (
              <div key={renderKey} id={'msg-' + msg.id} className="message-row message-communication" style={{ paddingTop: timelineMarkerHeight }}>
                {timelineMarkers}
                <CommunicationRecord message={msg} theme={t} onOpenSession={() => setShowCommunication(true)} />
              </div>
            )

          if (msg.type === 'narration')
            return (
              <div
                className={`message-narration ${messageEntranceClass}`}
                onAnimationEnd={event => event.currentTarget === event.target && messageEntranceClass && finishMessageEntrance(msg.id)}
                key={renderKey}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={event => event.preventDefault()}
                onSelectStart={event => event.preventDefault()}
                style={{ paddingTop: `calc(${timelineMarkerHeight}px + 2px)`, ...ownMessageLongPressStyle }}>
                {timelineMarkers}
                <div className="message-narration__dots">
                  {[0, 1, 2].map(i => (
                    <div key={i} />
                  ))}
                </div>
                {editingId === msg.id ? (
                  <div className="message-edit">
                    <TextInput className="message-edit__input" value={editText} onChange={event => setEditText(event.target.value)} onKeyDown={event => event.key === 'Enter' && editMessage(msg.id)} />
                    <div className="message-controls">
                      <Button variant="ghost" onClick={() => editMessage(msg.id)}>저장</Button>
                      <div className="message-control-divider" />
                      <Button variant="ghost" className="message-control--danger" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  </div>
                ) : (
                  <MessageEffectBubble
                    effectKey={msg.effect_key}
                    animateOnMount={Boolean(messageEntranceClass)}
                    effectDelayMs={textEffectDurationMs(msg.content, msg.text_effect_settings) + 280}
                    canReplay={allowMessageEffectReplay}
                    onEffectPlay={playMessageStageEffect}
                    indicatorSide="right"
                    className="message-narration__body"
                    style={{ cursor: msg.effect_key ? 'pointer' : 'default' }}>
                    <AnimatedMessageText
                      text={msg.content}
                      settings={msg.text_effect_settings}
                      messageId={renderKey}
                      animateOnMount={Boolean(messageEntranceClass)}
                      renderFinal={() => msg.content.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                    />
                  </MessageEffectBubble>
                )}
                <div className="message-narration__dots">
                  {[0, 1, 2].map(i => (
                    <div key={i} />
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
                className={`message-row message-row--chat${isMine ? ' message-row--mine' : ''} ${messageEntranceClass}`}
                onAnimationEnd={() => messageEntranceClass && finishMessageEntrance(msg.id)}
                key={renderKey}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={event => event.preventDefault()}
                onSelectStart={event => event.preventDefault()}
                style={{ paddingTop: timelineMarkerHeight, ...ownMessageLongPressStyle }}>
                {timelineMarkers}
                <div className="message-avatar-slot">
                  {showMessageIdentity && <div className="message-avatar"><img className="squircle-media" src={talkingAvatarUrl(msg)} alt="" /></div>}
                </div>
                <div className="message-content message-content--gallery">
                  {showMessageIdentity && char?.name && <div className="message-name">{char.name}</div>}
                  <div className="message-bubble message-gallery">
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
                        onContextMenu={event => event.preventDefault()}
                        onSelectStart={event => event.preventDefault()}
                        onClick={() => openImageMessage(url, imageUrls, imageIndex)}
                        style={{ gridColumn: imageUrls.length % 2 === 1 && imageIndex === imageUrls.length - 1 ? '1 / -1' : undefined }}
                      />
                    ))}
                  </div>
                  {imageMenuTarget?.message.id === msg.id ? (
                    <div className="message-action-menu message-controls" data-message-menu="true" onPointerDown={event => event.stopPropagation()}>
                      <Button variant="ghost" className="message-control--danger" onClick={() => deleteGalleryImage({ message: msg, imageIndex: imageMenuTarget.imageIndex })}>삭제</Button>
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
                className={`message-row message-row--chat${isMine ? ' message-row--mine' : ''} ${messageEntranceClass}`}
                onAnimationEnd={() => messageEntranceClass && finishMessageEntrance(msg.id)}
                key={renderKey}
                id={'msg-' + msg.id}
                onPointerDown={event => startLongPress(event, msg)}
                onPointerMove={moveLongPress}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={event => event.preventDefault()}
                onSelectStart={event => event.preventDefault()}
                style={{ paddingTop: timelineMarkerHeight, ...ownMessageLongPressStyle }}>
                {timelineMarkers}
                <div className="message-avatar-slot">
                  {showMessageIdentity && <div className="message-avatar" role="button" tabIndex={0} aria-label={`${char?.name || '프로필'} 사진 크게 보기`} onPointerDown={event => event.stopPropagation()} onClick={() => setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name, characterId: isMine ? msg.character_id : null })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name, characterId: isMine ? msg.character_id : null })} style={{ color: char?.text_color }}><img className="squircle-media" src={talkingAvatarUrl(msg)} alt="" /></div>}
                </div>
                <div className="message-content">
                  {showMessageIdentity && char?.name && <div className="message-name">{char.name}</div>}
                  <img className="message-bubble message-image" src={msg.content} onClick={() => openImageMessage(msg.content)} />
                  {showMessageTimestamp && <div className="message-timestamp message-timestamp--image">{new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>}
                  {renderMessageActions(msg, false)}
                  {renderDeliveryStatus(msg)}
                </div>
              </div>
            )

          return (
            <div
              className={`message-row message-row--chat${isMine ? ' message-row--mine' : ''} ${messageEntranceClass}`}
              onAnimationEnd={event => event.currentTarget === event.target && messageEntranceClass && finishMessageEntrance(msg.id)}
              key={renderKey}
              id={'msg-' + msg.id}
              onPointerDown={event => startLongPress(event, msg)}
              onPointerMove={moveLongPress}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={event => event.preventDefault()}
              onSelectStart={event => event.preventDefault()}
              style={{ paddingTop: timelineMarkerHeight, ...ownMessageLongPressStyle }}>
              {timelineMarkers}
              <div className="message-avatar-slot">
                {showMessageIdentity && <div className="message-avatar" role="button" tabIndex={0} aria-label={`${char?.name || '프로필'} 사진 크게 보기`} onPointerDown={event => event.stopPropagation()} onClick={() => setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name, characterId: isMine ? msg.character_id : null })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: char?.image_url || DEFAULT_AVATAR, name: char?.name, characterId: isMine ? msg.character_id : null })} style={{ color: char?.text_color }}><img className="squircle-media" src={talkingAvatarUrl(msg)} alt="" /></div>}
              </div>
              <div className="message-content">
                {showMessageIdentity && char?.name && <div className="message-name">{char.name}</div>}
                {editingId === msg.id ? (
                  <div className="message-edit">
                    <TextInput className="message-edit__input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && editMessage(msg.id)} />
                    <div className="message-controls">
                      <Button variant="ghost" onClick={() => editMessage(msg.id)}>저장</Button>
                      <div className="message-control-divider" />
                      <Button variant="ghost" className="message-control--danger" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  </div>
                ) : (
                  <MessageEffectBubble
                    effectKey={msg.effect_key}
                    animateOnMount={Boolean(messageEntranceClass)}
                    effectDelayMs={textEffectDurationMs(msg.content, msg.text_effect_settings) + 280}
                    canReplay={allowMessageEffectReplay}
                    onEffectPlay={playMessageStageEffect}
                    indicatorSide={isMine ? 'left' : 'right'}
                    className={hideMessageBubbles ? 'message-text-bubble message-text-bubble--transparent' : 'message-text-bubble'}
                    style={{ cursor: msg.effect_key || isMine ? 'pointer' : 'default' }}>
                    <AnimatedMessageText
                      text={msg.content}
                      settings={msg.text_effect_settings}
                      messageId={renderKey}
                      animateOnMount={Boolean(messageEntranceClass)}
                      renderFinal={() => parseContent(msg.content, actionSize)}
                    />
                    {msg.edited && showEditedLabel && <span className="message-edited">수정됨</span>}
                  </MessageEffectBubble>
                )}
                {renderMessageActions(msg)}
                {showMessageMeta && <div className="message-meta">
                  {showReadReceipt && (readReceipt === 'number'
                    ? <span aria-label={`${lastReadCount}명 읽음`} className="message-receipt">{lastReadCount}명 읽음</span>
                    : <span aria-label="읽음" className="message-receipt"><Eye size={11} />읽음</span>)}
                  {showMessageTimestamp && <div className="message-timestamp">{searchQuery ? new Date(msg.created_at).toLocaleDateString('ko-KR') + ' ' + new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>}
                  {hasOtherDeliveryStatus && renderDeliveryStatus(msg)}
                </div>}
                {!hasOtherDeliveryStatus && renderDeliveryStatus(msg)}
              </div>
            </div>
          )
        })}

        {/* 입력중 표시 */}
        {showTypingIndicator && typingInfo && typingInfo.expiresAt > Date.now() && (
          typingInfo.characterId ? (
            <div className="message-typing">
              <div className="message-typing__dots">
                {[0, 1, 2].map(index => <div key={index} style={{ animationDelay: `${index * 0.2}s` }} />)}
              </div>
              <span className="message-typing__label">{typingInfo.charName}{subjectParticle(typingInfo.charName)} 말하는 중...</span>
            </div>
          ) : (
            <div aria-label="나레이션 입력 중" className="message-typing message-typing--narration">
              {[0, 1, 2, 3, 4].map(index => <span key={index} aria-hidden="true" style={{ animationDelay: `${index * 0.34}s` }}>.</span>)}
            </div>
          )
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="room-composer">
        <div className="room-composer__scrim" aria-hidden="true" />
        {((myChars.length > 0 && !topCharacterPickerEnabled) || selectedMessageEffect) && (
          <div className="composer-context-row">
          {myChars.length > 0 && !topCharacterPickerEnabled && <Button
            variant="ghost"
            size="sm"
            className="composer-identity"
            data-narration={isNarrActive}
            onMouseDown={e => e.preventDefault()}
            onPointerDown={event => {
              preserveComposerFocus(event)
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
            aria-label={`현재 화자 ${isNarrActive ? '나레이션' : activeChar?.name || '미선택'}. 눌러서 변경`}
            aria-expanded={showCharList}>
            <span className="composer-identity__avatar" style={{ '--character-color': activeChar?.color }}>
              <img src={activeChar?.image_url || DEFAULT_AVATAR} alt="" />
            </span>
            <span className="composer-identity__text">
              <strong>{isNarrActive ? '나레이션' : activeChar?.name || '캐릭터 선택'}</strong>
            </span>
            {showCharList ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </Button>}
          <MessageEffectChip effectKey={selectedMessageEffect} onClear={() => setSelectedMessageEffect(null)} theme={t} />
          </div>
        )}
        {myChars.length > 0 && !topCharacterPickerEnabled && showCharList && (
          <div className={`profile-picker-reveal${closingCharList ? ' is-closing' : ''}`}>
            <div role="group" aria-label="캐릭터 선택" className="character-strip room-composer__characters">
              {myChars.map(c => (
                <button
                  key={c.id}
                  className="room-composer__character"
                  onMouseDown={e => e.preventDefault()}
                  onPointerDown={preserveComposerFocus}
                  onClick={() => chooseCharacter(c)}
                  aria-label={`${c.name} 선택`}
                  aria-pressed={activeChar?.id === c.id && mode === 'chat'}
                  title={c.name}>
                  <span style={{ '--character-color': c.color }}>
                    <img src={c.image_url || DEFAULT_AVATAR} alt="" />
                  </span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="room-composer__character-settings"
              onMouseDown={e => e.preventDefault()}
              onClick={() => navigate(`/room/${roomId}/characters`)}>
              설정
            </Button>
          </div>
        )}
        {myChars.length === 0 && !topCharacterPickerEnabled && (
          <Button variant="ghost" block className="room-composer__add-character" onClick={() => navigate('/characters')}>
            + 캐릭터 추가하기
          </Button>
        )}
        {showRoleplayMenu && (
          <div className="room-composer__tool-sheet-position" data-dragging={draggingToolSheet} style={{ transform: `translateY(${toolSheetOffset}px)` }}>
          <Card className={`room-tool-sheet${closingRoleplayMenu ? ' is-closing' : ''}`}>
            <button
              className="room-tool-sheet__handle"
              aria-label="아래로 끌어 도구 메뉴 닫기"
              onPointerDown={startToolSheetDrag}
              onPointerMove={moveToolSheetDrag}
              onPointerUp={finishToolSheetDrag}
              onPointerCancel={finishToolSheetDrag}
              onKeyDown={event => (event.key === 'Escape' || event.key === 'ArrowDown') && closeRoleplayMenu()}>
              <span />
            </button>
            {toolPanel === 'effects' ? (
              <MessageEffectPicker
                selectedEffect={selectedMessageEffect}
                theme={t}
                onBack={() => closeRoleplayMenu()}
                onSelect={effectKey => {
                  setSelectedMessageEffect(effectKey)
                  closeRoleplayMenu()
                  window.setTimeout(() => inputRef.current?.focus(), 210)
                }}
              />
            ) : <>
            {roomToolGroups.map(group => (
              <section key={group.id} className="room-tool-sheet__group">
                <div className="room-tool-sheet__group-label">{group.label}</div>
                <div className="room-tool-sheet__grid">
                  {group.tools.map(toolId => roomTools.find(tool => tool.id === toolId)).filter(Boolean).map(tool => {
                    const ToolIcon = tool.icon
                    const selected = favoriteTools.includes(tool.id)
                    const active = (tool.id === 'narration' && isNarrActive) || (tool.id === 'effects' && Boolean(selectedMessageEffect))
                    return (
                      <div key={tool.id} className="room-tool-sheet__tool" data-active={active}>
                        <Button
                          variant="ghost"
                          className="room-tool-sheet__run"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => runRoomTool(tool.id)}
                          aria-pressed={active}>
                          <ToolIcon size={17} />
                          <span>{tool.label}</span>
                        </Button>
                        <IconButton
                          className="room-tool-sheet__favorite"
                          active={selected}
                          onMouseDown={event => event.preventDefault()}
                          onClick={event => {
                            event.stopPropagation()
                            toggleQuickToolFavorite(tool.id)
                          }}
                          label={`${tool.label} 즐겨찾기 ${selected ? '해제' : '추가'}`}>
                          <Star size={13} fill={selected ? 'currentColor' : 'none'} />
                        </IconButton>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
            {toolPanel === 'divider' && (
              <div className="inline-panel-reveal room-tool-sheet__divider">
                <TextInput
                  className="room-tool-sheet__divider-input"
                  autoFocus
                  value={dividerText}
                  onChange={event => setDividerText(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      sendDivider()
                    }
                  }}
                  placeholder="구분선 문구"
                />
                <Button onMouseDown={event => event.preventDefault()} onClick={sendDivider}>
                  추가
                </Button>
              </div>
            )}
            {showRoomInvitePicker && (
              <div className="inline-panel-reveal room-tool-sheet__invites">
                <div>초대할 방을 선택하세요.</div>
                {invitableRooms.length === 0 ? (
                  <div className="room-tool-sheet__invites-empty">초대할 수 있는 다른 방이 없어요.</div>
                ) : (
                  invitableRooms.map(targetRoom => (
                    <Button key={targetRoom.id} variant="secondary" className="room-tool-sheet__invite" onMouseDown={event => event.preventDefault()} onClick={() => sendRoomInvite(targetRoom)}>
                      <span>{targetRoom.name}</span>
                      <Send size={13} />
                    </Button>
                  ))
                )}
              </div>
            )}
            </>}
          </Card>
          </div>
        )}
        {showQuickToolPicker && (
          <QuickToolPicker tools={favoriteRoomTools} activeId={quickTool} onSelect={selectQuickTool} />
        )}
        <div className="room-composer__row" data-sheet-open={showRoleplayMenu}>
          <IconButton
            className="room-composer__button"
            active={showRoleplayMenu}
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setShowQuickToolPicker(false); if (showRoleplayMenu) closeRoleplayMenu(); else openRoleplayMenu() }}
            label="대화 도구 메뉴"
            aria-expanded={showRoleplayMenu}>
            <span><Grid2X2 size={16} /></span>
          </IconButton>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" ref={fileInputRef} onChange={e => sendImages(e.target.files)} hidden />
          <TextArea
              className="room-composer__input"
              data-narration={isNarrActive}
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
                setShowQuickToolPicker(false)
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
            />
            {myChars.length > 0 && selectedQuickTool && (() => {
              const QuickToolIcon = selectedQuickTool.icon
              const quickActive = quickTool === 'narration' && isNarrActive
              return (
                <IconButton
                  className="room-composer__button room-composer__button--quick"
                  active={quickActive}
                  onMouseDown={e => e.preventDefault()}
                  onPointerDown={event => {
                    quickToolGestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
                    quickToolGestureHandledRef.current = false
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                  }}
                  onPointerMove={event => {
                    const gesture = quickToolGestureRef.current
                    if (!gesture || quickToolGestureHandledRef.current) return
                    const distanceY = gesture.startY - event.clientY
                    const distanceX = Math.abs(gesture.startX - event.clientX)
                    if (distanceY > 28 && distanceY > distanceX) {
                      quickToolGestureHandledRef.current = true
                      if (favoriteRoomTools.length > 1) {
                        if (showRoleplayMenu) closeRoleplayMenu()
                        setShowQuickToolPicker(true)
                      }
                    }
                  }}
                  onPointerUp={event => {
                    quickToolGestureRef.current = null
                    event.currentTarget.releasePointerCapture?.(event.pointerId)
                  }}
                  onPointerCancel={() => {
                    quickToolGestureRef.current = null
                    quickToolGestureHandledRef.current = false
                  }}
                  onClick={() => {
                    if (quickToolGestureHandledRef.current) {
                      quickToolGestureHandledRef.current = false
                      return
                    }
                    if (showQuickToolPicker) {
                      setShowQuickToolPicker(false)
                      return
                    }
                    runRoomTool(quickTool, true)
                  }}
                  onKeyDown={event => {
                    if (event.key === 'ArrowUp' && favoriteRoomTools.length > 1) {
                      event.preventDefault()
                      setShowQuickToolPicker(true)
                    } else if (event.key === 'Escape') {
                      setShowQuickToolPicker(false)
                    }
                  }}
                  label={`${selectedQuickTool.label} 빠른 실행${favoriteRoomTools.length > 1 ? '. 위로 밀어 즐겨찾기 선택' : ''}`}
                  aria-expanded={showQuickToolPicker}
                  title={selectedQuickTool.label}>
                  <span><QuickToolIcon size={16} /></span>
                </IconButton>
              )
            })()}
          {showSendActionMenu && <Card className="room-composer__send-menu" data-send-action-menu="true" role="menu" aria-label="전송 옵션" onKeyDown={event => event.key === 'Escape' && setShowSendActionMenu(false)}>
            <Button variant="ghost" block className="room-composer__send-option" role="menuitem" onMouseDown={event => event.preventDefault()} onPointerDown={preserveComposerFocus} onClick={openMessageEffectPicker}>
              <Sparkles size={17} />
              <span>
                <strong>대사 연출</strong>
                <small>{selectedMessageEffect ? '연출을 바꾸거나 해제해요.' : '보낼 대사에 효과를 적용해요.'}</small>
              </span>
            </Button>
          </Card>}
          <IconButton
            className="room-composer__button room-composer__button--send"
            disabled={!input.trim() || (!activeChar && !isNarrActive)}
            onMouseDown={event => event.preventDefault()}
            onPointerDown={event => {
              preserveComposerFocus(event)
              startSendButtonPress(event)
            }}
            onPointerMove={moveSendButtonPress}
            onPointerUp={finishSendButtonPress}
            onPointerCancel={cancelSendButtonPress}
            onContextMenu={event => event.preventDefault()}
            onClick={handleSendButtonClick}
            label="전송. 길게 눌러 추가 옵션 열기"
            aria-haspopup="menu"
            aria-expanded={showSendActionMenu}>
            <span><ArrowUp size={18} strokeWidth={2.5} /></span>
          </IconButton>
        </div>
      </div>

    </div>
  )
}
