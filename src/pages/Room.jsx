import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, uploadFile } from '../lib/supabase'
import { THEMES, getTheme } from '../lib/themes'
import { ChevronLeft, Link2, BookmarkPlus, Settings, Search, Calendar, Paperclip, ArrowUp, Eye, ArrowDown, ChevronDown, ChevronUp, Quote } from 'lucide-react'

const SLOT_DUMMY = [
    '아르카디아', '세렌디아', '발타자르', '엘리시온', '카르타고', '미스트헤임', '아스가르트',
    '티베리우스', '에오스테르', '네크로폴리스', '이스칸다르', '팔레스트리나',
    '솔리투도', '아우로라', '크림슨 홀', '아르테미시아', '에테르나',
    '라그나렉', '세라피나', '루시페리아', '발할라', '사라진 카리나',
    '황혼의 언덕', '안개 낀 숲', '폐역 플랫폼', '무너진 등대', '달빛 호수',
    '버려진 극장', '균열된 거울 속', '세계의 끝', '첫눈의 밤', '불타는 궁전',
    '빗속 골목길', '끝없는 복도', '지하 서고', '잊혀진 신전', '기억의 잔해',
    '멈춘 도시', '옥상 위', '새벽 카페', '심야 편의점', '폭풍의 해안',
    '허공에 뜬 섬', '늦가을 기차역', '설원', '유성우의 밤하늘', '꿈의 경계',
]

const ITEM_H = 48
const WINDOW_H = 240

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

        items.forEach((text) => {
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
    let last = 0, m
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>)
        parts.push(<span key={m.index} style={{ fontSize: '0.85em', color: actionStyle === 'dim' ? actColor : 'inherit', opacity: actionStyle === 'dim' ? 0.6 : 1 }}>{m[0]}</span>)
        last = m.index + m[0].length
    }
    if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>)
    return parts
}

export default function Room() {
    const { roomId } = useParams()
    const navigate = useNavigate()
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
    const [showChapterInput, setShowChapterInput] = useState(false)
    const [chapterName, setChapterName] = useState('')
    const [showSlot, setShowSlot] = useState(true)
    const [hideScroll, setHideScroll] = useState(false)
    const [newMsgAlert, setNewMsgAlert] = useState(false)
    const [editingRoomName, setEditingRoomName] = useState(false)
    const [roomNameText, setRoomNameText] = useState('')
    const [showCharList, setShowCharList] = useState(true)
    const scrollTimerRef = useRef(null)
    const fileInputRef = useRef(null)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const isAtBottomRef = useRef(true)
    const messageListRef = useRef(null)
    const initialScrollDone = useRef(false)
    const channelRef = useRef(null)

    const openPanel = (panel) => {
        setShowInvite(panel === 'invite')
        setShowTheme(panel === 'theme')
        setShowSearch(panel === 'search')
        setShowCalendar(panel === 'calendar')
    }

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUserId(user.id)
            await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)

            const { data: roomData } = await supabase.from('rooms').select().eq('id', roomId).single()
            setRoom(roomData)
            setReadReceipt(roomData?.read_receipt_style || 'text')
            setActionStyle(roomData?.action_style || 'dim')
            setIsOwner(roomData?.created_by === user.id)

            const { data: profile } = await supabase.from('profiles').select('theme_id, last_char_id').eq('id', user.id).single()
            const myId = profile?.theme_id || 'dark-purple'
            setMyThemeId(myId)

            const sharedId = roomData?.shared_theme_id || 'dark-purple'
            const follow = roomData?.theme_follow ?? true
            setSharedThemeId(sharedId)
            setFollowShared(follow)
            const resolvedTheme = getTheme(follow ? sharedId : myId)
            setTheme(resolvedTheme)
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme.panel)

            const { data: chars } = await supabase.from('characters').select().eq('user_id', user.id).eq('is_archived', false)
            setMyChars(chars || [])
            if (chars && chars.length > 0) {
                const { data: member } = await supabase.from('room_members').select('last_char_id').eq('room_id', roomId).eq('user_id', user.id).single()
                const lastChar = chars.find(c => c.id === member?.last_char_id)
                setActiveChar(lastChar || chars[0])
            }

            await fetchMessages()

            channelRef.current = supabase
                .channel('room-' + roomId)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
                    setRoom(prev => ({ ...prev, ...payload.new }))
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMsg = payload.new
                        const { data: char } = await supabase.from('characters').select('name, color, text_color, avatar_letter, image_url').eq('id', newMsg.character_id).single()
                        const fullMsg = { ...newMsg, characters: char || null }
                        setMessages(prev => {
                            const hastemp = prev.find(m => m.id.toString().startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id)
                            if (hastemp) return prev.map(m => m.id === hastemp.id ? fullMsg : m)
                            return [...prev, fullMsg]
                        })
                        if (!isAtBottomRef.current) setNewMsgAlert(true)
                        const { data: { user: currentUser } } = await supabase.auth.getUser()
                        if (newMsg.user_id !== currentUser.id) {
                            await supabase.from('messages').update({ read_by: [...(newMsg.read_by || []), currentUser.id] }).eq('id', newMsg.id)
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, read_by: payload.new.read_by, edited: payload.new.edited, content: payload.new.content } : m))
                    }
                })
                .subscribe()
        }
        init()
        return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    }, [roomId])

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
            setMessages(data)
            markAsRead(data)
            const dates = [...new Set(data.map(m => new Date(m.created_at).toLocaleDateString('ko-KR')))]
            setAvailableDates(dates)
        }
    }

    const markAsRead = async (msgs) => {
        const { data: { user } } = await supabase.auth.getUser()
        const unread = msgs.filter(m => m.user_id !== user.id && !m.read_by?.includes(user.id) && m.type !== 'chapter' && !m.id.toString().startsWith('temp-'))
        if (unread.length === 0) return
        await Promise.all(unread.map(m => supabase.from('messages').update({ read_by: [...(m.read_by || []), user.id] }).eq('id', m.id)))
        setMessages(prev => prev.map(m => unread.find(u => u.id === m.id) ? { ...m, read_by: [...(m.read_by || []), user.id] } : m))
    }

    const sendMessage = async () => {
        if (!input.trim()) return
        const { data: { user } } = await supabase.auth.getUser()
        const isNarr = mode === 'narration'
        const content = input.trim().replace(/\(([^)]*$)/g, '($1)')

        if (isNarr && messages.length > 0) {
            const last = messages[messages.length - 1]
            if (last.type === 'narration' && last.user_id === user.id) {
                const merged = last.content + '\n' + content
                setMessages(prev => prev.map(m => m.id === last.id ? { ...m, content: merged } : m))
                setInput('')
                inputRef.current?.focus()
                await supabase.from('messages').update({ content: merged }).eq('id', last.id)
                return
            }
        }

        const tempMsg = {
            id: 'temp-' + Date.now(), room_id: roomId, user_id: user.id,
            character_id: isNarr ? null : activeChar?.id,
            characters: activeChar ? { name: activeChar.name, color: activeChar.color, text_color: activeChar.text_color, avatar_letter: activeChar.avatar_letter, image_url: activeChar.image_url } : null,
            type: isNarr ? 'narration' : 'chat', content, edited: false, created_at: new Date().toISOString()
        }
        isAtBottomRef.current = true
        setMessages(prev => [...prev, tempMsg])
        setInput('')
        if (mode === 'narration') setMode('chat')
        inputRef.current?.focus()
        await supabase.from('messages').insert({ room_id: roomId, user_id: user.id, character_id: isNarr ? null : activeChar?.id, type: isNarr ? 'narration' : 'chat', content })
    }

    const editMessage = async (id) => {
        await supabase.from('messages').update({ content: editText, edited: true }).eq('id', id)
        setEditingId(null)
        setEditText('')
    }

    const addChapter = () => setShowChapterInput(true)

    const saveRoomName = async () => {
        if (!roomNameText.trim()) return
        await supabase.from('rooms').update({ name: roomNameText.trim() }).eq('id', roomId)
        setRoom(prev => ({ ...prev, name: roomNameText.trim() }))
        setEditingRoomName(false)
    }

    const submitChapter = async () => {
        if (!chapterName.trim()) return
        const { data: { user } } = await supabase.auth.getUser()
        const tempChapter = { id: 'temp-' + Date.now(), room_id: roomId, user_id: user.id, type: 'chapter', content: chapterName.trim(), created_at: new Date().toISOString() }
        setMessages(prev => [...prev, tempChapter])
        setChapterName('')
        setShowChapterInput(false)
        await supabase.from('messages').insert({ room_id: roomId, user_id: user.id, type: 'chapter', content: tempChapter.content })
    }

    const saveSharedTheme = async (id) => {
        setSharedThemeId(id)
        if (followShared) setTheme(getTheme(id))
        await supabase.from('rooms').update({ shared_theme_id: id }).eq('id', roomId)
    }

    const toggleFollow = async (val) => {
        setFollowShared(val)
        setTheme(getTheme(val ? sharedThemeId : myThemeId))
        await supabase.from('rooms').update({ theme_follow: val }).eq('id', roomId)
    }

    const sendImage = async (file) => {
        if (!file) return
        const { data: { user } } = await supabase.auth.getUser()
        const ext = file.name.split('.').pop()
        const path = `chat/${roomId}/${Date.now()}.${ext}`
        const url = await uploadFile(file, path)
        if (!url) return alert('업로드 실패')
        const tempMsg = {
            id: 'temp-' + Date.now(), room_id: roomId, user_id: user.id, character_id: activeChar?.id,
            characters: activeChar ? { name: activeChar.name, color: activeChar.color, text_color: activeChar.text_color, avatar_letter: activeChar.avatar_letter, image_url: activeChar.image_url } : null,
            type: 'image', content: url, edited: false, created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, tempMsg])
        await supabase.from('messages').insert({ room_id: roomId, user_id: user.id, character_id: activeChar?.id, type: 'image', content: url })
    }

    const t = theme || getTheme('dark-purple')
    const isNarrActive = mode === 'narration'
    const filteredMessages = messages.filter(msg => { if (!searchQuery) return true; return msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) })

    const iconBtn = (onClick, icon, active) => ({
        onClick,
        style: { background: active ? t.point + '22' : 'none', border: `0.5px solid ${active ? t.point : t.border}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    })

    if (!theme) return (
        <div style={{ height: '100dvh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
        </div>
    )

    return (
        <div style={{ height: '100dvh', background: t.bg, '--scrollbar-color': t.border, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>

            {showSlot && room && <SlotEntrance roomName={room.name} bgColor={t.bg} pointColor={t.point} onDone={() => setShowSlot(false)} />}

            {/* 헤더 */}
            <div style={{ background: t.panel, borderBottom: `0.5px solid ${t.border}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={22} color={t.subText} />
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{room?.name}</div>
                    <div style={{ fontSize: 10, color: t.subText }}>{room?.chapter}</div>
                </div>
                <button {...iconBtn(() => openPanel(showInvite ? null : 'invite'), null, showInvite)}><Link2 size={15} color={showInvite ? t.point : t.subText} /></button>
                <button {...iconBtn(addChapter, null, false)} style={{ ...iconBtn(addChapter, null, false).style, fontSize: 12, color: t.subText, gap: 3 }}><BookmarkPlus size={15} color={t.subText} /></button>
                <button {...iconBtn(() => openPanel(showTheme ? null : 'theme'), null, showTheme)}><Settings size={15} color={showTheme ? t.point : t.subText} /></button>
                <button {...iconBtn(() => openPanel(showSearch ? null : 'search'), null, showSearch)}><Search size={15} color={showSearch ? t.point : t.subText} /></button>
                <button {...iconBtn(() => openPanel(showCalendar ? null : 'calendar'), null, showCalendar)}><Calendar size={15} color={showCalendar ? t.point : t.subText} /></button>
            </div>

            {/* 초대 코드 패널 */}
            {showInvite && (
                <div style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowInvite(false)}>
                    <div style={{ background: t.panel, padding: '14px 16px', borderBottom: `0.5px solid ${t.border}`, textAlign: 'center', maxWidth: 480, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 11, color: t.subText, marginBottom: 4 }}>초대 코드</div>
                        <div style={{ fontSize: 22, fontWeight: 600, color: t.point, letterSpacing: 3 }}>{room?.invite_code}</div>
                        <div style={{ fontSize: 10, color: t.subText, marginTop: 4, opacity: 0.6 }}>상대방에게 이 코드를 알려주세요</div>
                    </div>
                </div>
            )}

            {/* 테마 패널 */}
            {showTheme && (
                <div style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowTheme(false)}>
                    <div style={{ background: t.panel, padding: '12px 14px', borderBottom: `0.5px solid ${t.border}`, maxWidth: 480, margin: '0 auto', width: '100%', overflowY: 'auto', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
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
                                <div style={{ fontSize: 11, color: t.subText, marginBottom: 8 }}>공유 테마 <span style={{ fontSize: 10, opacity: 0.6 }}>(방장만 변경 가능)</span></div>
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
                                    <button key={s} onClick={async () => { setReadReceipt(s); await supabase.from('rooms').update({ read_receipt_style: s }).eq('id', roomId) }}
                                        style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: readReceipt === s ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}`, background: readReceipt === s ? t.point + '22' : 'none', color: readReceipt === s ? t.point : t.subText }}>
                                        {s === 'text' ? '읽음' : s === 'number' ? '1' : '없음'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                            <div style={{ fontSize: 12, color: t.subText, width: 70 }}>지문 스타일</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {[{ val: 'dim', label: '흐리게' }, { val: 'bright', label: '밝게' }].map(s => (
                                    <button key={s.val} onClick={async () => { setActionStyle(s.val); await supabase.from('rooms').update({ action_style: s.val }).eq('id', roomId) }}
                                        style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: actionStyle === s.val ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}`, background: actionStyle === s.val ? t.point + '22' : 'none', color: actionStyle === s.val ? t.point : t.subText }}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {isOwner && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 12, color: t.subText, marginBottom: 6 }}>방 이름</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input value={roomNameText} onChange={e => setRoomNameText(e.target.value)} onFocus={() => setRoomNameText(room?.name || '')} onKeyDown={e => e.key === 'Enter' && saveRoomName()} placeholder={room?.name}
                                        style={{ flex: 1, background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '5px 10px', color: t.inputText, fontSize: 12, outline: 'none' }} />
                                    <button onClick={saveRoomName} style={{ background: t.point, border: 'none', borderRadius: 8, padding: '5px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>저장</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 검색 패널 */}
            {showSearch && (
                <div style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowSearch(false)}>
                    <div style={{ background: t.panel, padding: '10px 14px', borderBottom: `0.5px solid ${t.border}`, maxWidth: 480, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="대사 검색..." autoFocus
                            style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        {searchQuery && <div style={{ marginTop: 8, fontSize: 11, color: t.subText }}>{filteredMessages.length}개 검색됨</div>}
                    </div>
                </div>
            )}

            {/* 날짜 이동 패널 */}
            {showCalendar && (
                <div style={{ position: 'fixed', top: 49, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }} onClick={() => setShowCalendar(false)}>
                    <div style={{ background: t.panel, padding: '10px 14px', borderBottom: `0.5px solid ${t.border}`, maxWidth: 480, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 11, color: t.subText, marginBottom: 8 }}>날짜로 이동</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {availableDates.map(date => (
                                <button key={date} onClick={() => {
                                    const target = messages.find(m => new Date(m.created_at).toLocaleDateString('ko-KR') === date)
                                    if (target) { document.getElementById('msg-' + target.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setShowCalendar(false) }
                                }} style={{ padding: '4px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${t.border}`, background: 'none', color: t.subText }}>{date}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 화수 입력 모달 */}
            {showChapterInput && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: t.panel, borderRadius: 16, padding: 20, width: 280, border: `0.5px solid ${t.border}` }}>
                        <div style={{ fontSize: 14, color: t.theirText, fontWeight: 500, marginBottom: 12 }}>화수 이름</div>
                        <input value={chapterName} onChange={e => setChapterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitChapter()} placeholder="예) 2화 · 균열" autoFocus
                            style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={submitChapter} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: 9, color: '#fff', fontSize: 13, cursor: 'pointer' }}>추가</button>
                            <button onClick={() => { setShowChapterInput(false); setChapterName('') }} style={{ flex: 1, background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 9, color: t.subText, fontSize: 13, cursor: 'pointer' }}>취소</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 새 메시지 알림 버튼 */}
            {newMsgAlert && (
                <div onClick={scrollToBottom} style={{ position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: t.panel, border: `1px solid ${t.border}`, color: t.theirText, padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                    <ArrowDown size={13} color='#fff' />새 대화
                </div>
            )}

            {/* 메시지 목록 */}
            <div ref={messageListRef} onScroll={handleScroll} className={`chat-scroll${hideScroll ? ' hide-scroll' : ''}`}
                style={{ position: 'relative', flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', background: t.bg }}>
                {filteredMessages.map(msg => {
                    const isMine = msg.user_id === userId
                    const char = msg.characters

                    if (msg.type === 'chapter') return (
                        <div key={msg.id} id={'msg-' + msg.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                            <div style={{ flex: 1, height: 0.5, background: t.border }} />
                            <div style={{ fontSize: 11, color: t.chapColor, whiteSpace: 'nowrap' }}>{msg.content}</div>
                            <div style={{ flex: 1, height: 0.5, background: t.border }} />
                        </div>
                    )

                    if (msg.type === 'narration') return (
                        <div key={msg.id} id={'msg-' + msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '2px 0' }}>
                            <div style={{ display: 'flex', gap: 3 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: t.narrColor }} />)}</div>
                            {msg.content.split('\n').map((line, i) => <div key={i} style={{ fontSize: 11, color: t.narrColor, fontStyle: 'italic', textAlign: 'center', padding: '0 16px', lineHeight: 1.6 }}>{line}</div>)}
                            <div style={{ display: 'flex', gap: 3 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: t.narrColor }} />)}</div>
                        </div>
                    )

                    if (msg.type === 'image') return (
                        <div key={msg.id} id={'msg-' + msg.id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, width: 36 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: char?.color || t.border, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: char?.text_color || t.subText }}>
                                    {char?.image_url ? <img src={char.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : char?.avatar_letter || '?'}
                                </div>
                                {char?.name && <div style={{ fontSize: 9, color: t.subText, whiteSpace: 'nowrap', maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{char?.name}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                <img src={msg.content} style={{ maxWidth: 180, borderRadius: 10, cursor: 'pointer' }} onClick={() => window.open(msg.content, '_blank')} />
                                <div style={{ fontSize: 9, color: t.subText, marginTop: 2 }}>{new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    )

                    const bubbleBg = isMine ? t.myBubble : t.theirBubble
                    const bubbleColor = isMine ? t.myText : t.theirText
                    const actColor = isMine ? t.myAct : t.subText

                    return (
                        <div key={msg.id} id={'msg-' + msg.id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, width: 36 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: char?.color || t.border, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: char?.text_color || t.subText }}>
                                    {char?.image_url ? <img src={char.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : char?.avatar_letter || '?'}
                                </div>
                                {char?.name && <div style={{ fontSize: 9, color: t.subText, whiteSpace: 'nowrap', maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{char?.name}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                                {editingId === msg.id ? (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && editMessage(msg.id)}
                                            style={{ background: t.bg, border: `0.5px solid ${t.point}`, borderRadius: 8, padding: '6px 10px', color: t.inputText, fontSize: 12, outline: 'none' }} />
                                        <button onClick={() => editMessage(msg.id)} style={{ background: t.point, border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, cursor: 'pointer' }}>저장</button>
                                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '6px 10px', color: t.subText, fontSize: 11, cursor: 'pointer' }}>취소</button>
                                    </div>
                                ) : (
                                    <div onDoubleClick={() => { if (isMine) { setEditingId(msg.id); setEditText(msg.content) } }}
                                        style={{ background: bubbleBg, color: bubbleColor, padding: '7px 11px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, border: 'none', cursor: isMine ? 'pointer' : 'default' }}>
                                        {parseContent(msg.content, actColor, actionStyle)}
                                        {msg.edited && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>수정됨</span>}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                                    {msg.user_id === userId && readReceipt !== 'none' && (msg.read_by || []).some(id => id !== msg.user_id) && <Eye size={10} color={t.subText} opacity={0.4} />}
                                    <div style={{ fontSize: 9, color: t.subText, opacity: 0.6 }}>
                                        {searchQuery ? new Date(msg.created_at).toLocaleDateString('ko-KR') + ' ' + new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div style={{ background: t.panel, borderTop: `0.5px solid ${t.border}`, padding: '8px 10px 12px', touchAction: 'none', position: 'relative' }}>
                {myChars.length > 0 && (
                    <button onMouseDown={e => e.preventDefault()} onClick={() => setShowCharList(v => !v)}
                        style={{ position: 'absolute', top: -20, left: 10, background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: '6px 6px 0 0', borderBottom: `1px solid ${t.panel}`, padding: '2px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {showCharList ? <ChevronDown size={13} color={t.subText} /> : <ChevronUp size={13} color={t.subText} />}
                    </button>
                )}
                {myChars.length > 0 && showCharList && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                        <span style={{ fontSize: 10, color: t.subText, flexShrink: 0 }}>나</span>
                        <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
                            {myChars.map(c => (
                                <button key={c.id} onMouseDown={e => e.preventDefault()} onClick={async () => {
                                    setActiveChar(c); setMode('chat')
                                    const { data: { user } } = await supabase.auth.getUser()
                                    await supabase.from('room_members').update({ last_char_id: c.id }).eq('room_id', roomId).eq('user_id', user.id)
                                }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 4px', borderRadius: 20, border: activeChar?.id === c.id && mode === 'chat' ? `1.5px solid ${c.color || t.point}` : `1px solid ${t.border}`, background: activeChar?.id === c.id && mode === 'chat' ? (c.color + '22') : 'none', cursor: 'pointer' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: c.color || t.point, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: c.text_color || '#fff', overflow: 'hidden', flexShrink: 0 }}>
                                        {c.image_url ? <img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.avatar_letter}
                                    </div>
                                    <span style={{ fontSize: 11, color: activeChar?.id === c.id && mode === 'chat' ? t.theirText : t.subText }}>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {myChars.length === 0 && (
                    <button onClick={() => navigate('/characters')} style={{ width: '100%', background: 'none', border: `0.5px dashed ${t.border}`, borderRadius: 10, padding: '8px', color: t.subText, fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>+ 캐릭터 추가하기</button>
                )}
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
                    <button onMouseDown={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: `0.5px solid ${t.border}`, background: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Paperclip size={16} color={t.subText} />
                    </button>
                    <input type="file" accept="image/*,video/*,.gif" ref={fileInputRef} onChange={e => sendImage(e.target.files[0])} style={{ display: 'none' }} />
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                        <textarea ref={inputRef} value={input}
                            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px' }}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); sendMessage() } }}
                            placeholder={isNarrActive ? '나레이션 입력...' : activeChar ? `${activeChar.name}으로 입력...` : '캐릭터를 먼저 추가해주세요'}
                            enterKeyHint="enter"
                            rows={1}
                            style={{ flex: 1, background: t.inputBg, border: `0.5px solid ${isNarrActive ? t.point : t.border}`, borderRadius: 11, padding: '8px 11px', color: isNarrActive ? t.narrColor : t.inputText, fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5, fontStyle: isNarrActive ? 'italic' : 'normal' }}
                        />
                        {myChars.length > 0 && (
                            <button onMouseDown={e => e.preventDefault()} onClick={() => setMode(mode === 'narration' ? 'chat' : 'narration')}
                                style={{ position: 'absolute', right: 8, bottom: 7, padding: '2px', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'none', display: 'flex', alignItems: 'center' }}>
                                <Quote size={14} color={isNarrActive ? t.narrColor : t.subText} />
                            </button>
                        )}
                    </div>
                    <button onMouseDown={e => e.preventDefault()} onClick={sendMessage}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: t.point, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowUp size={18} color='#fff' strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    )
}
