import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { Settings, Users, ChevronRight, Trash2, CirclePlus, LogIn, Search, ListRestart, GripVertical, X } from 'lucide-react'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableRoomCard({ roomId, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: roomId, disabled })
  return (
    <div ref={setNodeRef} {...attributes} style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 2 : 1, opacity: isDragging ? 0.72 : 1 }}>
      {children({ listeners })}
    </div>
  )
}

export default function RoomList() {
  const [rooms, setRooms] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(null)
  const [userId, setUserId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [reordering, setReordering] = useState(false)
  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }))

  const channelRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
      const resolvedTheme = getTheme(data?.theme_id || 'dark-purple')
      setTheme(resolvedTheme)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme.panel)
      fetchRooms(user.id)

      channelRef.current = supabase
        .channel('roomlist-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          payload => {
            console.log('roomlist event:', payload.eventType)
            fetchRooms(user.id)
          }
        )
        .subscribe()
    }
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])
  const fetchRooms = async uid => {
    const id = uid || userId
    const { data } = await supabase.from('room_members').select('room_id, sort_order, rooms(*)').eq('user_id', id)
    if (!data) return

    const rooms = data.map(d => ({ ...d.rooms, sort_order: d.sort_order ?? 0 })).filter(room => room.id)

    const enriched = await Promise.all(
      rooms.map(async room => {
        const { data: lastMsg } = await supabase.from('messages').select('content, type, created_at, characters(name)').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1).single()

        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('room_id', room.id).not('read_by', 'cs', `{${id}}`).neq('user_id', id)

        return { ...room, lastMsg: lastMsg || null, unreadCount: count || 0 }
      })
    )

    const hasCustomOrder = data.some(member => (member.sort_order ?? 0) > 0)
    setRooms(
      enriched.sort((a, b) => {
        if (hasCustomOrder) return a.sort_order - b.sort_order
        const aTime = a.lastMsg?.created_at || a.created_at || ''
        const bTime = b.lastMsg?.created_at || b.created_at || ''
        return bTime.localeCompare(aTime)
      })
    )
  }

  const createRoom = async () => {
    if (!roomName.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: room } = await supabase
      .from('rooms')
      .insert({
        name: roomName,
        created_by: user.id,
      })
      .select()
      .single()
    if (room) {
      await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id, sort_order: rooms.length })
      await supabase.from('profiles').upsert({ id: user.id, email: user.email })
      setRoomName('')
      setShowCreate(false)
      fetchRooms()
    }
    setLoading(false)
  }

  const joinRoom = async () => {
    if (!inviteCode.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: room } = await supabase.from('rooms').select().eq('invite_code', inviteCode.trim()).single()
    if (room) {
      await supabase.from('profiles').upsert({ id: user.id, email: user.email })
      await supabase.from('room_members').upsert({ room_id: room.id, user_id: user.id, sort_order: rooms.length })
      setInviteCode('')
      setShowJoin(false)
      fetchRooms()
    } else {
      alert('초대 코드를 찾을 수 없어요.')
    }
    setLoading(false)
  }

  const deleteRoom = async (e, roomId, createdBy) => {
    e.stopPropagation()
    if (createdBy !== userId) {
      alert('방장만 삭제할 수 있어요.')
      return
    }
    if (!confirm('채팅방을 삭제할까요? 모든 대화 내용이 사라져요.')) return
    await supabase.from('messages').delete().eq('room_id', roomId)
    await supabase.from('room_members').delete().eq('room_id', roomId)
    await supabase.from('rooms').delete().eq('id', roomId)
    fetchRooms()
  }

  const handleRoomDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = rooms.findIndex(room => room.id === active.id)
    const newIndex = rooms.findIndex(room => room.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const orderedRooms = arrayMove(rooms, oldIndex, newIndex).map((room, index) => ({ ...room, sort_order: index }))
    setRooms(orderedRooms)
    const results = await Promise.all(orderedRooms.map((room, index) => supabase.from('room_members').update({ sort_order: index }).eq('room_id', room.id).eq('user_id', userId)))
    if (results.some(result => result.error)) {
      alert('채팅방 순서를 저장하지 못했어요.')
      fetchRooms()
    }
  }

  if (!theme)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
      </div>
    )

  const t = theme
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredRooms = rooms.filter(room => room.name.toLocaleLowerCase('ko-KR').includes(normalizedSearch))

  return (
    <div style={{ minHeight: '100vh', background: t.bg, padding: 16 }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 14,
            paddingTop: 8,
          }}>
          <div style={{ fontSize: 20, color: t.theirText, fontWeight: 600, flex: 1 }}>이데아</div>
          <button
            onClick={() => {
              setShowJoin(false)
              setShowCreate(current => !current)
            }}
            aria-label="새 역극방"
            title="새 역극방"
            style={{ width: 34, height: 34, background: showCreate ? `${t.point}22` : 'none', border: `1px solid ${showCreate ? t.point : t.border}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CirclePlus size={17} color={showCreate ? t.point : t.subText} />
          </button>
          <button
            onClick={() => {
              setShowCreate(false)
              setShowJoin(current => !current)
            }}
            aria-label="초대코드로 입장"
            title="초대코드로 입장"
            style={{ width: 34, height: 34, background: showJoin ? `${t.point}22` : 'none', border: `1px solid ${showJoin ? t.point : t.border}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogIn size={17} color={showJoin ? t.point : t.subText} />
          </button>
          <button onClick={() => setReordering(current => !current)} aria-label={reordering ? '순서 변경 완료' : '채팅방 순서 변경'} title={reordering ? '순서 변경 완료' : '채팅방 순서 변경'} style={{ width: 34, height: 34, background: reordering ? `${t.point}22` : 'none', border: `1px solid ${reordering ? t.point : t.border}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ListRestart size={17} color={reordering ? t.point : t.subText} />
          </button>
          <button onClick={() => navigate('/characters')} aria-label="캐릭터" title="캐릭터" style={{ width: 34, height: 34, background: 'none', border: `1px solid ${t.border}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={17} color={t.subText} />
          </button>
          <button onClick={() => navigate('/settings')} aria-label="설정" title="설정" style={{ width: 34, height: 34, background: 'none', border: `1px solid ${t.border}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={17} color={t.subText} />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} color={t.subText} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="역극방 이름 검색" aria-label="역극방 이름 검색" style={{ width: '100%', background: t.panel, border: `1px solid ${t.border}`, borderRadius: 10, padding: '9px 34px', color: t.inputText, fontSize: 12, outline: 'none' }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} aria-label="검색어 지우기" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}>
              <X size={14} color={t.subText} />
            </button>
          )}
        </div>

        {/* 방 만들기 폼 */}
        {showCreate && (
          <div
            style={{
              background: t.panel,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              border: `1px solid ${t.border}`,
              boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
            }}>
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
            style={{
              background: t.panel,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              border: `1px solid ${t.border}`,
              boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
            }}>
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
        {reordering && <div style={{ color: t.subText, fontSize: 11, marginBottom: 8 }}>손잡이를 끌어 채팅방 순서를 변경하세요.</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
          <SortableContext items={filteredRooms.map(room => room.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rooms.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    color: t.subText,
                    fontSize: 13,
                    marginTop: 40,
                    opacity: 0.5,
                  }}>
                  아직 채팅방이 없어요
                </div>
              )}
              {rooms.length > 0 && filteredRooms.length === 0 && <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 32, opacity: 0.6 }}>검색 결과가 없어요.</div>}
              {filteredRooms.map(room => (
                <SortableRoomCard key={room.id} roomId={room.id} disabled={!reordering}>
                  {({ listeners }) => (
                    <div
                      onClick={() => !reordering && navigate(`/room/${room.id}`)}
                      style={{
                        background: t.panel,
                        borderRadius: 12,
                        padding: '13px 15px',
                        cursor: reordering ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: `1px solid ${t.border}`,
                        boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
                      }}>
                      {reordering && (
                        <button {...listeners} onClick={event => event.stopPropagation()} aria-label={`${room.name} 순서 이동`} style={{ border: 0, background: 'none', padding: 2, display: 'flex', cursor: 'grab', touchAction: 'none' }}>
                          <GripVertical size={18} color={t.subText} />
                        </button>
                      )}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: t.point, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: t.bg, flexShrink: 0, overflow: 'hidden' }}>{room.cover_image ? <img src={room.cover_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '✦'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{room.name}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: t.subText,
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                          {room.lastMsg ? `${room.lastMsg.characters?.name || ''}: ${room.lastMsg.type === 'chat' ? room.lastMsg.content : '[이미지]'}` : ''}
                        </div>
                      </div>
                      {room.unreadCount > 0 && (
                        <div
                          style={{
                            background: t.point,
                            color: t.bg,
                            borderRadius: 10,
                            padding: '2px 7px',
                            fontSize: 11,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}>
                          {room.unreadCount}
                        </div>
                      )}
                      {!reordering && room.created_by === userId && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => deleteRoom(e, room.id, room.created_by)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            opacity: 0.4,
                            display: 'flex',
                            alignItems: 'center',
                          }}>
                          <Trash2 size={15} color={t.subText} />
                        </button>
                      )}
                      {!reordering && <ChevronRight size={18} color={t.subText} opacity={0.5} />}
                    </div>
                  )}
                </SortableRoomCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
