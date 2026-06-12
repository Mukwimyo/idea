import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'

export default function Groups() {
    const [theme, setTheme] = useState(null)
    const [userId, setUserId] = useState(null)
    const [tab, setTab] = useState('personal') // 'personal' | 'room'
    const [groups, setGroups] = useState([])
    const [rooms, setRooms] = useState([])
    const [allChars, setAllChars] = useState([])
    const [selectedGroup, setSelectedGroup] = useState(null) // 선택된 동아리
    const [groupChars, setGroupChars] = useState([]) // 선택된 동아리의 캐릭터 ids
    const [showNewGroup, setShowNewGroup] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupRoomId, setNewGroupRoomId] = useState('')
    const navigate = useNavigate()

    useEffect(() => { init() }, [])

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
        setTheme(getTheme(profile?.theme_id || 'dark-purple'))

        const { data: chars } = await supabase.from('characters')
            .select().eq('user_id', user.id).eq('is_archived', false)
        setAllChars(chars || [])

        const { data: roomData } = await supabase.from('room_members')
            .select('room_id, rooms(id, name)').eq('user_id', user.id)
        setRooms((roomData || []).map(d => d.rooms).filter(Boolean))

        fetchGroups(user.id, 'personal')
    }

    const fetchGroups = async (uid, type) => {
        const id = uid || userId
        let query = supabase.from('groups').select().eq('user_id', id).eq('type', type)
        const { data } = await query
        setGroups(data || [])
        setSelectedGroup(null)
    }

    const fetchGroupChars = async (groupId) => {
        const { data } = await supabase.from('character_groups')
            .select('character_id').eq('group_id', groupId)
        setGroupChars((data || []).map(d => d.character_id))
    }

    const createGroup = async () => {
        if (!newGroupName.trim()) return
        if (tab === 'room' && !newGroupRoomId) { alert('방을 선택해주세요'); return }
        const { data } = await supabase.from('groups').insert({
            user_id: userId,
            name: newGroupName.trim(),
            type: tab,
            room_id: tab === 'room' ? newGroupRoomId : null
        }).select().single()
        if (data) {
            setGroups(prev => [...prev, data])
            setNewGroupName('')
            setNewGroupRoomId('')
            setShowNewGroup(false)
        }
    }

    const deleteGroup = async (groupId) => {
        if (!confirm('동아리를 삭제할까요?')) return
        await supabase.from('character_groups').delete().eq('group_id', groupId)
        await supabase.from('groups').delete().eq('id', groupId)
        setGroups(prev => prev.filter(g => g.id !== groupId))
        if (selectedGroup?.id === groupId) setSelectedGroup(null)
    }

    const toggleChar = async (charId) => {
        const isIn = groupChars.includes(charId)
        if (isIn) {
            await supabase.from('character_groups').delete()
                .eq('group_id', selectedGroup.id).eq('character_id', charId)
            setGroupChars(prev => prev.filter(id => id !== charId))
        } else {
            await supabase.from('character_groups').insert({
                group_id: selectedGroup.id, character_id: charId
            })
            setGroupChars(prev => [...prev, charId])
        }
    }

    const handleTabChange = (newTab) => {
        setTab(newTab)
        setSelectedGroup(null)
        fetchGroups(userId, newTab)
    }

    const handleSelectGroup = (g) => {
        setSelectedGroup(g)
        fetchGroupChars(g.id)
    }

    if (!theme) return (
        <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
        </div>
    )

    const t = theme

    return (
        <div style={{ minHeight: '100vh', background: t.bg, padding: 16 }}>
            <div style={{ maxWidth: 400, margin: '0 auto' }}>

                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', marginRight: 8, display: 'flex', alignItems: 'center' }}>
                        <ChevronLeft size={22} color={t.subText} />
                    </button>
                    <div style={{ fontSize: 16, color: t.theirText, fontWeight: 500, flex: 1 }}>
                        {selectedGroup ? selectedGroup.name : '동아리'}
                    </div>
                    {!selectedGroup && (
                        <button onClick={() => setShowNewGroup(true)} style={{
                            background: t.point, border: 'none', borderRadius: 8,
                            padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4
                        }}>
                            <Plus size={13} color='#fff' /> 추가
                        </button>
                    )}
                    {selectedGroup && (
                        <button onClick={() => setSelectedGroup(null)} style={{
                            background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8,
                            padding: '6px 14px', color: t.subText, fontSize: 12, cursor: 'pointer'
                        }}>목록</button>
                    )}
                </div>

                {/* 탭 */}
                {!selectedGroup && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {[{ key: 'personal', label: '내 동아리' }, { key: 'room', label: '방별 동아리' }].map(tb => (
                            <button key={tb.key} onClick={() => handleTabChange(tb.key)} style={{
                                flex: 1, padding: '8px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                                border: tab === tb.key ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}`,
                                background: tab === tb.key ? t.point + '22' : t.panel,
                                color: tab === tb.key ? t.point : t.subText
                            }}>{tb.label}</button>
                        ))}
                    </div>
                )}

                {/* 새 동아리 폼 */}
                {showNewGroup && !selectedGroup && (
                    <div style={{ background: t.panel, borderRadius: 12, padding: 14, marginBottom: 12, border: `0.5px solid ${t.border}` }}>
                        <div style={{ fontSize: 13, color: t.subText, marginBottom: 8 }}>새 동아리</div>
                        <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createGroup()}
                            placeholder="동아리 이름 *" autoFocus
                            style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                        {tab === 'room' && (
                            <select value={newGroupRoomId} onChange={e => setNewGroupRoomId(e.target.value)}
                                style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: newGroupRoomId ? t.inputText : t.subText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}>
                                <option value="">방 선택 *</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={createGroup} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: 9, color: '#fff', fontSize: 12, cursor: 'pointer' }}>만들기</button>
                            <button onClick={() => { setShowNewGroup(false); setNewGroupName(''); setNewGroupRoomId('') }} style={{ flex: 1, background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 9, color: t.subText, fontSize: 12, cursor: 'pointer' }}>취소</button>
                        </div>
                    </div>
                )}

                {/* 동아리 목록 */}
                {!selectedGroup && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {groups.length === 0 && (
                            <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 40, opacity: 0.5 }}>동아리가 없어요</div>
                        )}
                        {groups.map(g => (
                            <div key={g.id} onClick={() => handleSelectGroup(g)}
                                style={{ background: t.panel, borderRadius: 12, padding: '13px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: `0.5px solid ${t.border}` }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{g.name}</div>
                                    {tab === 'room' && rooms.find(r => r.id === g.room_id) && (
                                        <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{rooms.find(r => r.id === g.room_id)?.name}</div>
                                    )}
                                </div>
                                <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); deleteGroup(g.id) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4, display: 'flex', alignItems: 'center' }}>
                                    <X size={15} color={t.subText} />
                                </button>
                                <ChevronRight size={16} color={t.subText} opacity={0.5} />
                            </div>
                        ))}
                    </div>
                )}

                {/* 캐릭터 선택 */}
                {selectedGroup && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, color: t.subText, marginBottom: 4, opacity: 0.7 }}>캐릭터를 선택해서 동아리에 추가하세요</div>
                        {allChars.length === 0 && (
                            <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 40, opacity: 0.5 }}>캐릭터가 없어요</div>
                        )}
                        {allChars.map(c => {
                            const isIn = groupChars.includes(c.id)
                            return (
                                <div key={c.id} onClick={() => toggleChar(c.id)}
                                    style={{ background: t.panel, borderRadius: 12, padding: '12px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: isIn ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}` }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: c.text_color, flexShrink: 0, overflow: 'hidden' }}>
                                        {c.image_url ? <img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.avatar_letter}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{c.name}</div>
                                        {c.description && <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{c.description}</div>}
                                    </div>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: isIn ? `none` : `1.5px solid ${t.border}`, background: isIn ? t.point : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {isIn && <Check size={13} color='#fff' strokeWidth={3} />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}