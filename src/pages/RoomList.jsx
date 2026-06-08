import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { Settings, Users, ChevronRight, Trash2 } from 'lucide-react'

export default function RoomList() {
  const [rooms, setRooms] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(null)
  const [userId, setUserId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
    setTheme(getTheme(data?.theme_id || 'dark-purple'))
    fetchRooms(user.id)
  }

  const fetchRooms = async (uid) => {
    const id = uid || userId
    const { data } = await supabase
      .from('room_members')
      .select('room_id, rooms(*)')
      .eq('user_id', id)
    if (data) setRooms(data.map(d => d.rooms).filter(Boolean))
  }

  const createRoom = async () => {
    if (!roomName.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: room } = await supabase.from('rooms').insert({
      name: roomName, created_by: user.id
    }).select().single()
    if (room) {
      await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id })
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
    const { data: { user } } = await supabase.auth.getUser()
    const { data: room } = await supabase.from('rooms').select().eq('invite_code', inviteCode.trim()).single()
    if (room) {
      await supabase.from('profiles').upsert({ id: user.id, email: user.email })
      await supabase.from('room_members').upsert({ room_id: room.id, user_id: user.id })
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
    if (createdBy !== userId) { alert('방장만 삭제할 수 있어요.'); return }
    if (!confirm('채팅방을 삭제할까요? 모든 대화 내용이 사라져요.')) return
    await supabase.from('messages').delete().eq('room_id', roomId)
    await supabase.from('room_members').delete().eq('room_id', roomId)
    await supabase.from('rooms').delete().eq('id', roomId)
    fetchRooms()
  }

  if (!theme) return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
    </div>
  )

  const t = theme

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'sans-serif', padding: 16 }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
          <div style={{ fontSize: 20, color: t.theirText, fontWeight: 600 }}>이데아</div>
          <button onClick={() => navigate('/characters')} style={{
            marginLeft: 'auto', marginRight: 8, background: 'none', border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
            borderRadius: 8, padding: '6px 12px', color: t.subText, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            <Users size={14} color={t.subText} />
            <span style={{ fontSize: 12 }}>캐릭터</span>
          </button>
          <button onClick={() => navigate('/settings')} style={{
            background: 'none', border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
            borderRadius: 8, padding: '6px 12px', color: t.subText, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            <Settings size={14} color={t.subText} />
            <span style={{ fontSize: 12 }}>설정</span>
          </button>
        </div>

        {/* 방 만들기 / 입장 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setShowCreate(true)} style={{
            flex: 1, background: t.point, border: 'none', borderRadius: 10,
            padding: '10px', color: t.bg, fontSize: 13, cursor: 'pointer'
          }}>+ 새 역극방</button>
          <button onClick={() => setShowJoin(true)} style={{
            flex: 1, background: t.panel, border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`, borderRadius: 10,
            padding: '10px', color: t.subText, fontSize: 13, cursor: 'pointer'
          }}>초대코드로 입장</button>
        </div>

        {/* 방 만들기 폼 */}
        {showCreate && (
          <div style={{ background: t.panel, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)` }}>
            <div style={{ fontSize: 13, color: t.subText, marginBottom: 8 }}>채팅방 이름</div>
            <input value={roomName} onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="예) 세라핀 × 리온"
              style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={createRoom} disabled={loading} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: '9px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>만들기</button>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`, borderRadius: 8, padding: '9px', color: t.subText, fontSize: 12, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        )}

        {/* 초대코드 입장 폼 */}
        {showJoin && (
          <div style={{ background: t.panel, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)` }}>
            <div style={{ fontSize: 13, color: t.subText, marginBottom: 8 }}>초대 코드</div>
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              placeholder="8자리 코드 입력"
              style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={joinRoom} disabled={loading} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: '9px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>입장</button>
              <button onClick={() => setShowJoin(false)} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)`, borderRadius: 8, padding: '9px', color: t.subText, fontSize: 12, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        )}

        {/* 방 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms.length === 0 && (
            <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 40, opacity: 0.5 }}>
              아직 채팅방이 없어요
            </div>
          )}
          {rooms.map(room => (
            <div key={room.id} onClick={() => navigate(`/room/${room.id}`)}
              style={{ background: t.panel, borderRadius: 12, padding: '13px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${t.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.15)` }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: t.point, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', flexShrink: 0 }}>✦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{room.name}</div>
                <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{room.chapter}</div>
              </div>
              {room.created_by === userId && (
                <button onMouseDown={e => e.stopPropagation()} onClick={(e) => deleteRoom(e, room.id, room.created_by)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4, display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={15} color={t.subText} />
                </button>
              )}
              <ChevronRight size={18} color={t.subText} opacity={0.5} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}