import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEFAULT_THEME_ID, getTheme } from '../lib/themes'
import { useThemeVars } from '../lib/themeVars'
import { Settings, Users, Trash2, CirclePlus, LogIn, Search, ListRestart, GripVertical, X, Star, Clock3, MoreHorizontal, MessageCircle, Folder, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Card, IconButton, TextInput } from '../components/ui'
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
    <div
      ref={setNodeRef}
      {...attributes}
      className="room-list-sortable"
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 40 : elevated ? 30 : 'auto', opacity: isDragging ? 0.72 : 1 }}>
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
    const resolvedTheme = getTheme(data?.theme_id || DEFAULT_THEME_ID)
    localStorage.setItem('idea-theme-id', data?.theme_id || DEFAULT_THEME_ID)
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

  const t = theme
  useThemeVars(t)

  if (!theme)
    return <LoadingScreen />

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
        <Card
          interactive
          className={`room-list-card room-card-transition${playInitialRoomAnimation ? ' room-card-first-enter' : ''}`}
          onClick={() => !reordering && navigate(`/room/${room.id}`)}
          style={{
            cursor: reordering ? 'default' : 'pointer',
            animationDelay: playInitialRoomAnimation ? `${Math.min(roomIndex, 10) * 70}ms` : undefined,
          }}>
          {reordering && (
            <IconButton
              {...listeners}
              className="room-list-icon-button room-list-card__drag"
              onClick={event => event.stopPropagation()}
              label={`${room.name} 순서 이동`}>
              <GripVertical size={18} />
            </IconButton>
          )}
          <div className="room-list-card__cover squircle-media">
            {room.cover_image ? <img src={room.cover_image} alt="" /> : '✦'}
          </div>
          <div className="room-list-card__content">
            <div className="room-list-card__heading">
              {room.is_favorite && <Star size={14} className="room-list-card__favorite" fill="currentColor" aria-label="즐겨찾기" />}
              <div className="room-list-card__name">{room.name}</div>
              {room.lastMsg?.created_at && <time className="room-list-card__time">{formatRoomTime(room.lastMsg.created_at)}</time>}
            </div>
            <div className="room-list-card__preview">
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
          {room.unreadCount > 0 && <div className="room-list-card__unread">{room.unreadCount}</div>}
          {!reordering && <div className="room-list-card__actions">
            <IconButton
              className="room-list-icon-button"
              onMouseDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setRoomMenuId(current => current === room.id ? null : room.id) }}
              label={`${room.name} 메뉴`}>
              <MoreHorizontal size={19} />
            </IconButton>
            {roomMenuId === room.id && <Card className="message-action-menu room-list-card-menu" onClick={event => event.stopPropagation()}>
              <Button variant="ghost" block className="room-list-card-menu__action" onClick={event => { toggleFavorite(event, room); setRoomMenuId(null) }}>
                <Star size={15} fill={room.is_favorite ? 'currentColor' : 'none'} />
                {room.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
              </Button>
              <div className="room-list-card-menu__group">
                <label htmlFor={`room-group-${room.id}`} className="room-list-field-label">그룹 이동</label>
                <select className="ui-input room-list-input" id={`room-group-${room.id}`} value={room.room_group_id || ''} onChange={event => moveRoom(room, event.target.value)}>
                  <option value="">미분류</option>
                  {roomGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </div>
              {room.created_by === userId && (
                <Button variant="ghost" block className="room-list-card-menu__action room-list-card-menu__action--danger" onClick={event => { setRoomMenuId(null); deleteRoom(event, room.id, room.created_by) }}>
                  <Trash2 size={15} />채팅방 삭제
                </Button>
              )}
            </Card>}
          </div>}
        </Card>
      )}
    </SortableRoomCard>
  )

  return (
    <div className="room-list-page" style={{ backgroundImage: `url("${backgroundLogo}")` }}>
      <Toast toast={toast} />
      <ConfirmDialog
        open={Boolean(confirmation)}
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
      <div className="room-list-shell">
        {/* 헤더 */}
        <div className="room-list-header">
          <div className="room-list-header__brand">
            <img className="room-list-header__logo" src={headerLogo} alt="IDEA" />
          </div>
          <Button
            className="room-list-primary-action"
            onClick={() => {
              setShowGroupCreate(false)
              if (showCreate || showJoin) {
                setShowCreate(false)
                setShowJoin(false)
              } else {
                setShowCreate(true)
              }
            }}
            aria-label="새 대화"
            aria-expanded={showCreate || showJoin}>
            <CirclePlus size={17} /><span>새 대화</span>
          </Button>
          {sortMode === 'manual' && (
            <IconButton
              className="room-list-icon-action"
              onClick={() => setReordering(current => !current)}
              label={reordering ? '순서 변경 완료' : '채팅방 순서 변경'}
              active={reordering}>
              <ListRestart size={17} />
            </IconButton>
          )}
          <IconButton className="room-list-icon-action" onClick={() => navigate('/characters')} label="캐릭터">
            <Users size={17} />
          </IconButton>
          <IconButton className="room-list-icon-action" onClick={() => navigate('/settings')} label="설정">
            <Settings size={17} />
          </IconButton>
        </div>

        <div className="room-list-search">
          <Search size={15} className="room-list-search__icon" />
          <TextInput
            className="room-list-input room-list-search__input"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="역극방 이름 검색"
            aria-label="역극방 이름 검색"
          />
          {searchQuery && (
            <IconButton className="room-list-icon-button room-list-search__clear" onClick={() => setSearchQuery('')} label="검색어 지우기">
              <X size={14} />
            </IconButton>
          )}
        </div>

        <div className="room-list-sort">
          <Button
            variant="ghost"
            className={`room-list-sort__button${sortMode === 'recent' ? ' is-active' : ''}`}
            onClick={() => changeSortMode('recent')}>
            <Clock3 size={13} />최근 대화순
          </Button>
          <Button
            variant="ghost"
            className={`room-list-sort__button${sortMode === 'manual' ? ' is-active' : ''}`}
            onClick={() => changeSortMode('manual')}>
            <GripVertical size={13} />직접 정렬
          </Button>
        </div>

        <div className="room-list-group-actions">
          <Button
            variant="secondary"
            className="room-list-group-create"
            onClick={() => {
              setShowCreate(false)
              setShowJoin(false)
              setShowGroupCreate(current => !current)
            }}
            aria-expanded={showGroupCreate}>
            <FolderPlus size={14} />새 그룹
          </Button>
        </div>

        {showGroupCreate && <RoomGroupCreatePanel onCreate={addRoomGroup} onClose={() => setShowGroupCreate(false)} />}

        {/* 방 만들기 폼 */}
        {showCreate && (
          <Card className="inline-panel-reveal room-list-inline-panel">
            <div className="room-list-panel-tabs">
              <Button variant="ghost" className="room-list-panel-tab is-active">방 만들기</Button>
              <Button variant="ghost" className="room-list-panel-tab" onClick={() => { setShowCreate(false); setShowJoin(true) }}>초대 코드</Button>
            </div>
            <div className="room-list-field-label">채팅방 이름</div>
            <TextInput
              aria-label="채팅방 이름"
              className="room-list-input"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="예) 세라핀 × 리온"
            />
            <RoomGroupPicker
              groups={roomGroups}
              value={createRoomGroupId}
              onChange={setCreateRoomGroupId}
              disabled={loading}
            />
            <div className="room-list-panel-actions">
              <Button onClick={createRoom} disabled={loading}>만들기</Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>취소</Button>
            </div>
          </Card>
        )}

        {/* 초대코드 입장 폼 */}
        {showJoin && (
          <Card className="inline-panel-reveal room-list-inline-panel">
            <div className="room-list-panel-tabs">
              <Button variant="ghost" className="room-list-panel-tab" onClick={() => { setShowJoin(false); setShowCreate(true) }}>방 만들기</Button>
              <Button variant="ghost" className="room-list-panel-tab is-active">초대 코드</Button>
            </div>
            <div className="room-list-field-label">초대 코드</div>
            <TextInput
              aria-label="초대 코드"
              className="room-list-input"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              placeholder="8자리 코드 입력"
            />
            <RoomGroupPicker
              groups={roomGroups}
              value={joinRoomGroupId}
              onChange={setJoinRoomGroupId}
              disabled={loading}
            />
            <div className="room-list-panel-actions">
              <Button onClick={joinRoom} disabled={loading}>입장</Button>
              <Button variant="secondary" onClick={() => setShowJoin(false)}>취소</Button>
            </div>
          </Card>
        )}

        {/* 방 목록 */}
        {reordering && <div className="reorder-mode-reveal room-list-reorder-hint">손잡이를 끌어 채팅방 순서를 변경하세요.</div>}
        <div>
          {rooms.length === 0 && (
            <div className="room-list-empty">
              <div className="room-list-empty__icon"><MessageCircle size={27} /></div>
              <strong className="room-list-empty__title">첫 이야기를 시작해보세요</strong>
              <span className="room-list-empty__description">새 역극방을 만들거나 받은 초대 코드로 친구의 방에 들어갈 수 있어요.</span>
              <div className="room-list-empty__actions">
                <Button onClick={() => { setShowJoin(false); setShowCreate(true) }}><CirclePlus size={15} /> 방 만들기</Button>
                <Button variant="secondary" onClick={() => { setShowCreate(false); setShowJoin(true) }}><LogIn size={15} /> 코드 입장</Button>
              </div>
            </div>
          )}
          {rooms.length > 0 && filteredRooms.length === 0 && <div className="room-list-no-results">검색 결과가 없어요.</div>}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
          <div className={`room-list-groups${rooms.length === 0 ? ' room-list-groups--empty' : ''}`}>
            {roomGroupSections.map(section => {
              const collapsed = collapsedGroupIds.has(section.id)
              const unreadCount = section.rooms.reduce((sum, room) => sum + room.unreadCount, 0)
              return (
                <section className="room-list-group" key={section.id}>
                  <div className="room-list-group__header">
                    <Button
                      variant="ghost"
                      className="room-list-group__toggle"
                      onClick={() => toggleRoomGroup(section.id)}
                      aria-expanded={!collapsed}>
                      {collapsed ? <ChevronRight size={14} className="room-list-group__chevron" /> : <ChevronDown size={14} className="room-list-group__chevron" />}
                      <Folder size={14} className={section.id === UNASSIGNED_ROOM_GROUP_ID ? 'room-list-group__chevron' : 'room-list-group__folder'} />
                      <strong className="room-list-group__name">{section.name}</strong>
                      <span className="room-list-group__count">{section.rooms.length}</span>
                      {unreadCount > 0 && <span className="room-list-group__unread">{unreadCount}</span>}
                    </Button>
                    {section.id !== UNASSIGNED_ROOM_GROUP_ID && (
                      <IconButton className="room-list-icon-button room-list-group__delete" label={`${section.name} 그룹 삭제`} onClick={() => removeRoomGroup(section)}>
                        <Trash2 size={13} />
                      </IconButton>
                    )}
                  </div>
                  {!collapsed && (
                    <SortableContext items={section.rooms.map(room => room.id)} strategy={verticalListSortingStrategy}>
                      <div className="room-list-group__rooms">
                        {section.rooms.map(renderRoomCard)}
                        {section.rooms.length === 0 && <div className="room-list-group__empty">아직 이 그룹에 방이 없어요.</div>}
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
