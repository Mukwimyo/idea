import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { Settings, Users, Trash2, CirclePlus, LogIn, Search, ListRestart, GripVertical, X, Star, Clock3, MoreHorizontal, MessageCircle, Folder, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconButton } from '../components/ui'
import LoadingScreen from '../components/LoadingScreen'
import EntryCharacterPicker from '../components/EntryCharacterPicker'
import RoomGroupCreatePanel from '../components/RoomGroupCreatePanel'
import RoomGroupPicker from '../components/RoomGroupPicker'
import ConfirmDialog from '../components/ConfirmDialog'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import useConfirmDialog from '../hooks/useConfirmDialog'
import { normalizeRoomSummaries, sortRoomList } from '../features/rooms/roomSummary'
import {
  UNASSIGNED_ROOM_GROUP_ID,
  buildRoomGroupSections,
  createRoomGroup,
  createRoomInGroup,
  deleteRoomGroup,
  fetchRoomGroups,
  moveRoomToGroup,
} from '../features/rooms/roomGroups'
import { createClientMessageId, findRoomByInviteCode, joinRoomWithInvite } from '../features/messages/messageApi'

function SortableRoomCard({ roomId, disabled, elevated = false, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: roomId, disabled })
  return (
    <div ref={setNodeRef} {...attributes} style={{ width: '100%', minWidth: 0, maxWidth: '100%', transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 40 : elevated ? 30 : 'auto', opacity: isDragging ? 0.72 : 1 }}>
      {children({ listeners })}
    </div>
  )
}

const loadCollapsedRoomGroups = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('idea-collapsed-room-groups') || '[]')
    return new Set(Array.isArray(stored) ? stored : [])
  } catch {
    return new Set()
  }
}

export default function RoomList() {
  const { toast, showToast } = useToast()
  const { confirmation, confirm, closeConfirmation } = useConfirmDialog()
  const [rooms, setRooms] = useState([])
  const [roomGroups, setRoomGroups] = useState([])
  const [createRoomGroupId, setCreateRoomGroupId] = useState(null)
  const [joinRoomGroupId, setJoinRoomGroupId] = useState(null)
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(loadCollapsedRoomGroups)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showGroupCreate, setShowGroupCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [pendingJoinRoom, setPendingJoinRoom] = useState(null)
  const [entryCharacters, setEntryCharacters] = useState([])
  const [entryJoining, setEntryJoining] = useState(false)
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(null)
  const [userId, setUserId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [reordering, setReordering] = useState(false)
  const [roomMenuId, setRoomMenuId] = useState(null)
  const [sortMode, setSortMode] = useState(() => localStorage.getItem('idea-room-sort-mode') || 'recent')
  const [playInitialRoomAnimation, setPlayInitialRoomAnimation] = useState(() => sessionStorage.getItem('idea-room-list-entered') !== '1')
  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }))

  const channelRef = useRef(null)
  const refreshTimerRef = useRef(null)
  const fetchRoomsRef = useRef(null)
  const initialRoomAnimationRef = useRef(false)

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
    const resolvedTheme = getTheme(data?.theme_id || 'dark-purple')
    localStorage.setItem('idea-theme-id', data?.theme_id || 'dark-purple')
      setTheme(resolvedTheme)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme.panel)
      fetchGroups()
      fetchRoomsRef.current?.(user.id)

      const scheduleRefresh = () => {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = window.setTimeout(() => fetchRoomsRef.current?.(user.id), 120)
      }

      channelRef.current = supabase
        .channel('roomlist-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          scheduleRefresh
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_read_cursors' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `user_id=eq.${user.id}` }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_groups', filter: `user_id=eq.${user.id}` }, () => {
          fetchGroups()
          scheduleRefresh()
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') scheduleRefresh()
        })
    }
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      window.clearTimeout(refreshTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!playInitialRoomAnimation || rooms.length === 0 || initialRoomAnimationRef.current) return
    initialRoomAnimationRef.current = true
    sessionStorage.setItem('idea-room-list-entered', '1')
    const finishTimer = window.setTimeout(() => setPlayInitialRoomAnimation(false), Math.min(rooms.length, 10) * 70 + 520)
    return () => window.clearTimeout(finishTimer)
  }, [playInitialRoomAnimation, rooms.length])
  const fetchRooms = async uid => {
    const id = uid || userId
    const { data: summaryRows, error: summaryError } = await supabase.rpc('get_my_room_summaries')
    if (!summaryError && summaryRows) {
      const summarizedRooms = normalizeRoomSummaries(summaryRows)
      const activeSortMode = localStorage.getItem('idea-room-sort-mode') || 'recent'
      setRooms(sortRoomList(summarizedRooms, activeSortMode))
      return
    }

    console.warn('room summary RPC unavailable; using legacy queries:', summaryError?.message)
    let { data, error } = await supabase.from('room_members').select('room_id, room_group_id, sort_order, is_favorite, rooms(*)').eq('user_id', id)
    if (error) {
      const fallback = await supabase.from('room_members').select('room_id, sort_order, rooms(*)').eq('user_id', id)
      data = fallback.data?.map(member => ({ ...member, is_favorite: false })) || null
      error = fallback.error
    }
    if (error) {
      console.error('room list fetch failed:', error.message)
      return
    }
    if (!data) return

    const rooms = data.map(d => ({ ...d.rooms, room_group_id: d.room_group_id || null, sort_order: d.sort_order ?? 0, is_favorite: d.is_favorite === true })).filter(room => room.id)

    const enriched = await Promise.all(
      rooms.map(async room => {
        const { data: lastMsg } = await supabase.from('messages').select('content, type, created_at, characters(name)').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1).single()

        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('room_id', room.id).not('read_by', 'cs', `{${id}}`).neq('user_id', id)

        return { ...room, lastMsg: lastMsg || null, unreadCount: count || 0 }
      })
    )

    const activeSortMode = localStorage.getItem('idea-room-sort-mode') || 'recent'
    setRooms(sortRoomList(enriched, activeSortMode))
  }

  useLayoutEffect(() => {
    fetchRoomsRef.current = fetchRooms
  })

  const fetchGroups = async () => {
    try {
      setRoomGroups(await fetchRoomGroups(supabase))
    } catch (error) {
      console.warn('room group fetch failed:', error.message)
    }
  }

  const addRoomGroup = async name => {
    try {
      const group = await createRoomGroup(supabase, name, roomGroups.length)
      setRoomGroups(current => [...current, group])
      return group
    } catch (error) {
      showToast(error?.code === '23505' ? '같은 이름의 방 그룹이 이미 있어요.' : '방 그룹을 만들지 못했어요.', 'error')
      return null
    }
  }

  const changeSortMode = mode => {
    setSortMode(mode)
    setReordering(false)
    localStorage.setItem('idea-room-sort-mode', mode)
    setRooms(current => sortRoomList(current, mode))
  }

  const toggleFavorite = async (event, room) => {
    event.stopPropagation()
    const next = !room.is_favorite
    setRooms(current => sortRoomList(current.map(item => (item.id === room.id ? { ...item, is_favorite: next } : item)), sortMode))
    const { error } = await supabase.from('room_members').update({ is_favorite: next }).eq('room_id', room.id).eq('user_id', userId)
    if (error) {
      setRooms(current => current.map(item => (item.id === room.id ? { ...item, is_favorite: !next } : item)))
      showToast('즐겨찾기를 저장하지 못했어요.', 'error')
    }
  }

  const createRoom = async () => {
    if (!roomName.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    try {
      const room = await createRoomInGroup(supabase, roomName, createRoomGroupId)
      await supabase.from('profiles').upsert({ id: user.id, email: user.email })
      setRoomName('')
      setCreateRoomGroupId(null)
      setShowCreate(false)
      fetchRooms()
      if (!room) showToast('대화방 생성 결과를 확인하지 못했어요.', 'error')
    } catch (error) {
      console.warn('room creation failed:', error.message)
      showToast('대화방을 만들지 못했어요.', 'error')
    }
    setLoading(false)
  }

  const joinRoom = async () => {
    if (!inviteCode.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let room = null
    try {
      room = await findRoomByInviteCode(supabase, inviteCode)
    } catch (error) {
      console.warn('invite lookup failed:', error.message)
    }
    if (room) {
      await supabase.from('profiles').upsert({ id: user.id, email: user.email })
      const { data: existingMember } = await supabase.from('room_members').select('room_id').eq('room_id', room.id).eq('user_id', user.id).maybeSingle()
      if (existingMember) {
        try {
          await moveRoomToGroup(supabase, room.id, joinRoomGroupId)
        } catch (error) {
          console.warn('existing room group update failed:', error.message)
          showToast('방 그룹을 저장하지 못했어요.', 'error')
          setLoading(false)
          return
        }
        setInviteCode('')
        setJoinRoomGroupId(null)
        setShowJoin(false)
        fetchRooms()
      } else {
        const { data: characters } = await supabase.from('characters').select('*').eq('user_id', user.id).eq('is_archived', false).order('sort_order').order('created_at')
        setEntryCharacters(characters || [])
        setPendingJoinRoom(room)
      }
    } else {
      showToast('초대 코드를 찾을 수 없어요.', 'error')
    }
    setLoading(false)
  }

  const completeJoinRoom = async character => {
    if (!pendingJoinRoom || !character) return
    setEntryJoining(true)
    try {
      await joinRoomWithInvite(supabase, inviteCode, character.id, createClientMessageId(), joinRoomGroupId)
    } catch (error) {
      console.warn('room join failed:', error.message)
      setEntryJoining(false)
      showToast('대화방에 입장하지 못했어요.', 'error')
      return
    }
    setEntryJoining(false)
    setPendingJoinRoom(null)
    setInviteCode('')
    setJoinRoomGroupId(null)
    setShowJoin(false)
    fetchRooms()
  }

  const moveRoom = async (room, roomGroupId) => {
    const nextGroupId = roomGroupId || null
    setRooms(current => current.map(item => item.id === room.id ? { ...item, room_group_id: nextGroupId } : item))
    setRoomMenuId(null)
    try {
      await moveRoomToGroup(supabase, room.id, nextGroupId)
      showToast('방 그룹을 옮겼어요.')
    } catch (error) {
      console.warn('room group move failed:', error.message)
      showToast('방 그룹을 옮기지 못했어요.', 'error')
      fetchRooms()
    }
  }

  const removeRoomGroup = async group => {
    const accepted = await confirm({
      title: `${group.name} 그룹을 삭제할까요?`,
      description: '그룹 안의 방은 삭제되지 않고 미분류로 이동해요.',
      confirmLabel: '그룹 삭제',
      danger: true,
    })
    if (!accepted) return
    try {
      await deleteRoomGroup(supabase, group.id)
      setRoomGroups(current => current.filter(item => item.id !== group.id))
      setRooms(current => current.map(room => room.room_group_id === group.id ? { ...room, room_group_id: null } : room))
      showToast('방 그룹을 삭제했어요.')
    } catch (error) {
      console.warn('room group delete failed:', error.message)
      showToast('방 그룹을 삭제하지 못했어요.', 'error')
    }
  }

  const toggleRoomGroup = groupId => {
    setCollapsedGroupIds(current => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      localStorage.setItem('idea-collapsed-room-groups', JSON.stringify([...next]))
      return next
    })
  }

  const deleteRoom = async (e, roomId, createdBy) => {
    e.stopPropagation()
    if (createdBy !== userId) {
      showToast('방장만 채팅방을 삭제할 수 있어요.', 'error')
      return
    }
    const accepted = await confirm({
      title: '채팅방을 삭제할까요?',
      description: '모든 대화 내용이 사라지며 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      danger: true,
    })
    if (!accepted) return
    await supabase.from('messages').delete().eq('room_id', roomId)
    await supabase.from('room_members').delete().eq('room_id', roomId)
    await supabase.from('rooms').delete().eq('id', roomId)
    fetchRooms()
  }

  const handleRoomDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const activeRoom = rooms.find(room => room.id === active.id)
    const overRoom = rooms.find(room => room.id === over.id)
    if (!activeRoom || !overRoom || activeRoom.room_group_id !== overRoom.room_group_id) return
    const groupRooms = rooms.filter(room => room.room_group_id === activeRoom.room_group_id)
    const oldIndex = groupRooms.findIndex(room => room.id === active.id)
    const newIndex = groupRooms.findIndex(room => room.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const orderedGroupRooms = arrayMove(groupRooms, oldIndex, newIndex).map((room, index) => ({ ...room, sort_order: index }))
    setRooms(current => current.map(room => orderedGroupRooms.find(item => item.id === room.id) || room))
    const results = await Promise.all(
      orderedGroupRooms.map((room, index) => supabase.from('room_members').update({ sort_order: index }).eq('room_id', room.id).eq('user_id', userId))
    )
    if (results.some(result => result.error)) {
      showToast('채팅방 순서를 저장하지 못했어요.', 'error')
      fetchRooms()
    }
  }

  if (!theme)
    return <LoadingScreen />

  const t = theme
  const logoVariant = t.dark ? 'dark' : 'light'
  const headerLogo = `${import.meta.env.BASE_URL}branding/idea-logo-header-${logoVariant}.png`
  const backgroundLogo = `${import.meta.env.BASE_URL}branding/idea-logo-background-tile-${logoVariant}.png`
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('ko-KR')
  const roomGroupNameById = new Map(roomGroups.map(group => [group.id, group.name.toLocaleLowerCase('ko-KR')]))
  const filteredRooms = rooms.filter(room =>
    room.name.toLocaleLowerCase('ko-KR').includes(normalizedSearch)
    || (room.room_group_id && roomGroupNameById.get(room.room_group_id)?.includes(normalizedSearch))
  )
  const formatRoomTime = value => {
    if (!value) return ''
    const date = new Date(value)
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  }
  const roomGroupSections = buildRoomGroupSections(
    filteredRooms,
    roomGroups,
    groupRooms => sortRoomList(groupRooms, sortMode)
  ).filter(section => !normalizedSearch || section.rooms.length > 0)

  const renderRoomCard = (room, roomIndex) => (
    <SortableRoomCard key={room.id} roomId={room.id} disabled={!reordering} elevated={roomMenuId === room.id}>
      {({ listeners }) => (
        <div
          className={`room-card-transition${playInitialRoomAnimation ? ' room-card-first-enter' : ''}`}
          onClick={() => !reordering && navigate(`/room/${room.id}`)}
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            background: t.panel,
            borderRadius: 12,
            padding: '13px 15px',
            cursor: reordering ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: `1px solid ${t.border}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            animationDelay: playInitialRoomAnimation ? `${Math.min(roomIndex, 10) * 70}ms` : undefined,
          }}>
          {reordering && <button {...listeners} onClick={event => event.stopPropagation()} aria-label={`${room.name} 순서 이동`} style={{ border: 0, background: 'none', padding: 2, display: 'flex', cursor: 'grab', touchAction: 'none' }}><GripVertical size={18} color={t.subText} /></button>}
          <div className="squircle-media" style={{ width: 48, height: 48, background: t.point, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: t.bg, flexShrink: 0, overflow: 'hidden' }}>{room.cover_image ? <img src={room.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '✦'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {room.is_favorite && <Star size={14} color={t.point} fill={t.point} aria-label="즐겨찾기" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15, fontWeight: 600, color: t.theirText }}>{room.name}</div>
              {room.lastMsg?.created_at && <time style={{ color: t.subText, fontSize: 11, flexShrink: 0 }}>{formatRoomTime(room.lastMsg.created_at)}</time>}
            </div>
            <div style={{ fontSize: 11, color: t.subText, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {room.lastMsg
                ? room.lastMsg.type === 'chat'
                  ? `${room.lastMsg.characters?.name || ''}: ${room.lastMsg.content}`
                  : room.lastMsg.type === 'room_invite'
                    ? '[대화방 초대]'
                    : room.lastMsg.type === 'member_joined' || room.lastMsg.type === 'member_left'
                      ? room.lastMsg.content
                      : room.lastMsg.type === 'image' || room.lastMsg.type === 'image_group'
                        ? '[이미지]'
                        : room.lastMsg.type === 'random_result'
                          ? '[랜덤 결과]'
                          : `[${room.lastMsg.type === 'narration' ? '나레이션' : '시스템 메시지'}]`
                : ''}
            </div>
          </div>
          {room.unreadCount > 0 && <div style={{ background: t.point, color: t.bg, borderRadius: 10, padding: '2px 7px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{room.unreadCount}</div>}
          {!reordering && <div style={{ position: 'relative' }}>
            <IconButton
              onMouseDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setRoomMenuId(current => current === room.id ? null : room.id) }}
              label={`${room.name} 메뉴`}
              borderColor="transparent"
              pointColor={t.point}
              color={t.subText}
              style={{ width: 44, height: 44 }}>
              <MoreHorizontal size={19} />
            </IconButton>
            {roomMenuId === room.id && <div className="message-action-menu" onClick={event => event.stopPropagation()} style={{ position: 'absolute', zIndex: 20, top: 42, right: 0, width: 190, padding: 5, border: `1px solid ${t.border}`, borderRadius: 11, background: t.panel, boxShadow: '0 10px 28px rgba(0,0,0,.28)' }}>
              <button onClick={event => { toggleFavorite(event, room); setRoomMenuId(null) }} style={{ width: '100%', minHeight: 40, display: 'flex', alignItems: 'center', gap: 9, padding: '0 10px', border: 0, borderRadius: 8, background: 'transparent', color: t.theirText, fontSize: 12 }}><Star size={15} fill={room.is_favorite ? 'currentColor' : 'none'} />{room.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}</button>
              <div style={{ padding: '5px 9px 8px' }}>
                <label htmlFor={`room-group-${room.id}`} style={{ display: 'block', marginBottom: 5, color: t.subText, fontSize: 9 }}>그룹 이동</label>
                <select id={`room-group-${room.id}`} value={room.room_group_id || ''} onChange={event => moveRoom(room, event.target.value)} style={{ width: '100%', padding: '7px 8px', border: `1px solid ${t.border}`, borderRadius: 7, background: t.bg, color: t.inputText, fontSize: 11 }}>
                  <option value="">미분류</option>
                  {roomGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </div>
              {room.created_by === userId && <button onClick={event => { setRoomMenuId(null); deleteRoom(event, room.id, room.created_by) }} style={{ width: '100%', minHeight: 40, display: 'flex', alignItems: 'center', gap: 9, padding: '0 10px', border: 0, borderRadius: 8, background: 'transparent', color: '#f87171', fontSize: 12 }}><Trash2 size={15} />채팅방 삭제</button>}
            </div>}
          </div>}
        </div>
      )}
    </SortableRoomCard>
  )

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        overflowX: 'hidden',
        backgroundColor: t.bg,
        backgroundImage: `url("${backgroundLogo}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center top',
        backgroundSize: '450px 450px',
        padding: 16,
        transition: 'background-color 0.3s',
      }}>
      <Toast toast={toast} />
      <ConfirmDialog
        open={Boolean(confirmation)}
        theme={t}
        {...confirmation}
        onConfirm={() => closeConfirmation(true)}
        onCancel={() => closeConfirmation(false)}
      />
      <EntryCharacterPicker
        open={Boolean(pendingJoinRoom)}
        roomName={pendingJoinRoom?.name}
        characters={entryCharacters}
        theme={t}
        loading={entryJoining}
        onSelect={completeJoinRoom}
        onClose={() => !entryJoining && setPendingJoinRoom(null)}
      />
      <div style={{ width: '100%', minWidth: 0, maxWidth: 400, margin: '0 auto', position: 'relative' }}>
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 14,
            paddingTop: 8,
          }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <img src={headerLogo} alt="IDEA" style={{ display: 'block', width: 84, height: 'auto', maxHeight: 42, objectFit: 'contain', objectPosition: 'left center' }} />
          </div>
          <button
            className="ui-touch-target"
            onClick={() => {
              setShowGroupCreate(false)
              if (showCreate || showJoin) {
                setShowCreate(false)
                setShowJoin(false)
              } else {
                setShowCreate(true)
              }
            }}
            aria-expanded={showCreate || showJoin}
            style={{ height: 44, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: showCreate || showJoin ? `${t.point}22` : t.point, border: `1px solid ${t.point}`, borderRadius: 11, color: showCreate || showJoin ? t.point : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <CirclePlus size={17} />새 대화
          </button>
          {sortMode === 'manual' && (
            <button
              onClick={() => setReordering(current => !current)}
              aria-label={reordering ? '순서 변경 완료' : '채팅방 순서 변경'}
              title={reordering ? '순서 변경 완료' : '채팅방 순서 변경'}
              style={{ width: 40, height: 40, background: reordering ? `${t.point}22` : 'none', border: `1px solid ${reordering ? t.point : t.border}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ListRestart size={17} color={reordering ? t.point : t.subText} />
            </button>
          )}
          <button
            onClick={() => navigate('/characters')}
            aria-label="캐릭터"
            title="캐릭터"
            className="ui-touch-target"
            style={{ width: 44, height: 44, background: 'none', border: `1px solid ${t.border}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={17} color={t.subText} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            aria-label="설정"
            title="설정"
            className="ui-touch-target"
            style={{ width: 44, height: 44, background: 'none', border: `1px solid ${t.border}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Settings size={17} color={t.subText} />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} color={t.subText} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="역극방 이름 검색" aria-label="역극방 이름 검색" style={{ width: '100%', minHeight: 44, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 11, padding: '10px 38px', color: t.inputText, fontSize: 14, outline: 'none' }} />
          {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="검색어 지우기" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}><X size={14} color={t.subText} /></button>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12, padding: 4, borderRadius: 11, border: `1px solid ${t.border}`, background: `color-mix(in srgb, ${t.panel} 86%, transparent)` }}>
          <button
            onClick={() => changeSortMode('recent')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 9px', border: 0, borderRadius: 8, background: sortMode === 'recent' ? `${t.point}28` : 'transparent', color: sortMode === 'recent' ? t.point : t.subText, fontSize: 11, cursor: 'pointer' }}>
            <Clock3 size={13} />최근 대화순
          </button>
          <button
            onClick={() => changeSortMode('manual')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 9px', border: 0, borderRadius: 8, background: sortMode === 'manual' ? `${t.point}28` : 'transparent', color: sortMode === 'manual' ? t.point : t.subText, fontSize: 11, cursor: 'pointer' }}>
            <GripVertical size={13} />직접 정렬
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false)
              setShowJoin(false)
              setShowGroupCreate(current => !current)
            }}
            aria-expanded={showGroupCreate}
            style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 11px', border: `1px solid ${showGroupCreate ? t.point : t.border}`, borderRadius: 9, background: showGroupCreate ? `${t.point}22` : t.panel, color: showGroupCreate ? t.point : t.subText, fontSize: 11, cursor: 'pointer' }}>
            <FolderPlus size={14} />새 그룹
          </button>
        </div>

        {showGroupCreate && <RoomGroupCreatePanel onCreate={addRoomGroup} onClose={() => setShowGroupCreate(false)} theme={t} />}

        {/* 방 만들기 폼 */}
        {showCreate && (
          <div
            className="inline-panel-reveal"
            style={{
              background: t.panel,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              border: `1px solid ${t.border}`,
              boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
            }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14, padding: 4, borderRadius: 10, background: t.bg }}>
              <button style={{ minHeight: 38, border: 0, borderRadius: 8, background: `${t.point}28`, color: t.point, fontSize: 12, fontWeight: 600 }}>방 만들기</button>
              <button onClick={() => { setShowCreate(false); setShowJoin(true) }} style={{ minHeight: 38, border: 0, borderRadius: 8, background: 'transparent', color: t.subText, fontSize: 12 }}>초대 코드</button>
            </div>
            <div style={{ fontSize: 13, color: t.subText, marginBottom: 8 }}>채팅방 이름</div>
            <input
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="예) 세라핀 × 리온"
              style={{
                width: '100%',
                background: t.bg,
                border: `1px solid ${t.border}`,
                boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
                borderRadius: 8,
                padding: '9px 12px',
                color: t.inputText,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <RoomGroupPicker
              groups={roomGroups}
              value={createRoomGroupId}
              onChange={setCreateRoomGroupId}
              theme={t}
              disabled={loading}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={createRoom}
                disabled={loading}
                style={{
                  flex: 1,
                  background: t.point,
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                만들기
              </button>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: `1px solid ${t.border}`,
                  boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
                  borderRadius: 8,
                  padding: '9px',
                  color: t.subText,
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                취소
              </button>
            </div>
          </div>
        )}

        {/* 초대코드 입장 폼 */}
        {showJoin && (
          <div
            className="inline-panel-reveal"
            style={{
              background: t.panel,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              border: `1px solid ${t.border}`,
              boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
            }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14, padding: 4, borderRadius: 10, background: t.bg }}>
              <button onClick={() => { setShowJoin(false); setShowCreate(true) }} style={{ minHeight: 38, border: 0, borderRadius: 8, background: 'transparent', color: t.subText, fontSize: 12 }}>방 만들기</button>
              <button style={{ minHeight: 38, border: 0, borderRadius: 8, background: `${t.point}28`, color: t.point, fontSize: 12, fontWeight: 600 }}>초대 코드</button>
            </div>
            <div style={{ fontSize: 13, color: t.subText, marginBottom: 8 }}>초대 코드</div>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              placeholder="8자리 코드 입력"
              style={{
                width: '100%',
                background: t.bg,
                border: `1px solid ${t.border}`,
                boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
                borderRadius: 8,
                padding: '9px 12px',
                color: t.inputText,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <RoomGroupPicker
              groups={roomGroups}
              value={joinRoomGroupId}
              onChange={setJoinRoomGroupId}
              theme={t}
              disabled={loading}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={joinRoom}
                disabled={loading}
                style={{
                  flex: 1,
                  background: t.point,
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                입장
              </button>
              <button
                onClick={() => setShowJoin(false)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: `1px solid ${t.border}`,
                  boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
                  borderRadius: 8,
                  padding: '9px',
                  color: t.subText,
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                취소
              </button>
            </div>
          </div>
        )}

        {/* 방 목록 */}
        {reordering && <div className="reorder-mode-reveal" style={{ color: t.subText, fontSize: 11, marginBottom: 8 }}>손잡이를 끌어 채팅방 순서를 변경하세요.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms.length === 0 && (
            <div className="ui-empty-state" style={{ color: t.subText }}>
              <div className="ui-empty-state__icon" style={{ color: t.point, background: `${t.point}18`, border: `1px solid ${t.point}38` }}><MessageCircle size={27} /></div>
              <strong style={{ color: t.theirText, fontSize: 16 }}>첫 이야기를 시작해보세요</strong>
              <span style={{ maxWidth: 270, fontSize: 13, lineHeight: 1.6 }}>새 역극방을 만들거나 받은 초대 코드로 친구의 방에 들어갈 수 있어요.</span>
              <div className="ui-empty-state__actions">
                <button onClick={() => { setShowJoin(false); setShowCreate(true) }} style={{ border: 0, background: t.point, color: '#fff' }}><CirclePlus size={15} /> 방 만들기</button>
                <button onClick={() => { setShowCreate(false); setShowJoin(true) }} style={{ border: `1px solid ${t.border}`, background: t.panel, color: t.theirText }}><LogIn size={15} /> 코드 입장</button>
              </div>
            </div>
          )}
          {rooms.length > 0 && filteredRooms.length === 0 && <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 32, opacity: 0.6 }}>검색 결과가 없어요.</div>}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
          <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', display: 'grid', gap: 15, marginTop: rooms.length === 0 ? 10 : 0 }}>
            {roomGroupSections.map(section => {
              const collapsed = collapsedGroupIds.has(section.id)
              const unreadCount = section.rooms.reduce((sum, room) => sum + room.unreadCount, 0)
              return (
                <section key={section.id} style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 34, marginBottom: collapsed ? 0 : 7 }}>
                    <button
                      type="button"
                      onClick={() => toggleRoomGroup(section.id)}
                      aria-expanded={!collapsed}
                      style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '5px 2px', border: 0, background: 'transparent', color: t.theirText, textAlign: 'left' }}>
                      {collapsed ? <ChevronRight size={14} color={t.subText} /> : <ChevronDown size={14} color={t.subText} />}
                      <Folder size={14} color={section.id === UNASSIGNED_ROOM_GROUP_ID ? t.subText : t.point} />
                      <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{section.name}</strong>
                      <span style={{ color: t.subText, fontSize: 10 }}>{section.rooms.length}</span>
                      {unreadCount > 0 && <span style={{ marginLeft: 2, padding: '1px 6px', borderRadius: 9, background: `${t.point}24`, color: t.point, fontSize: 9 }}>{unreadCount}</span>}
                    </button>
                    {section.id !== UNASSIGNED_ROOM_GROUP_ID && (
                      <button type="button" aria-label={`${section.name} 그룹 삭제`} onClick={() => removeRoomGroup(section)} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, borderRadius: 8, background: 'transparent', color: t.subText, opacity: 0.58 }}><Trash2 size={13} /></button>
                    )}
                  </div>
                  {!collapsed && (
                    <SortableContext items={section.rooms.map(room => room.id)} strategy={verticalListSortingStrategy}>
                      <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', display: 'grid', gap: 8 }}>
                        {section.rooms.map(renderRoomCard)}
                        {section.rooms.length === 0 && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${t.panel}88`, color: t.subText, fontSize: 11 }}>아직 이 그룹에 방이 없어요.</div>}
                      </div>
                    </SortableContext>
                  )}
                </section>
              )
            })}
          </div>
        </DndContext>
      </div>
    </div>
  )
}
