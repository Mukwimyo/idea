import { useEffect, useState } from 'react'
import { Check, MapPin, Plus, Save, StickyNote, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function RoomWorldPanel({ open, initialTab = 'locations', roomId, userId, activeCharacter, theme, onClose, onSceneChange }) {
  const [tab, setTab] = useState(initialTab)
  const [locations, setLocations] = useState([])
  const [currentLocationId, setCurrentLocationId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = theme

  useEffect(() => {
    if (!open) return undefined
    let active = true
    const load = async () => {
      const [{ data: placeRows, error: placeError }, { data: roomRow }, { data: noteRow, error: noteError }] = await Promise.all([
        supabase.from('room_locations').select('*').eq('room_id', roomId).order('sort_order').order('created_at'),
        supabase.from('rooms').select('current_location_id').eq('id', roomId).single(),
        supabase.from('room_shared_notes').select('content').eq('room_id', roomId).maybeSingle(),
      ])
      if (!active) return
      if (placeError || noteError) setError('장소와 메모를 불러오지 못했어요. 마이그레이션 적용 여부를 확인해주세요.')
      setLocations(placeRows || [])
      setCurrentLocationId(roomRow?.current_location_id || null)
      setNote(noteRow?.content || '')
    }
    load()
    const channel = supabase
      .channel(`room-world-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_locations', filter: `room_id=eq.${roomId}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => setCurrentLocationId(payload.new?.current_location_id || null))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_shared_notes', filter: `room_id=eq.${roomId}` }, payload => {
        if (payload.new?.updated_by !== userId) setNote(payload.new?.content || '')
      })
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [open, roomId, userId])

  if (!open) return null

  const addLocation = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.from('room_locations').insert({
      room_id: roomId,
      name: newName.trim(),
      description: newDescription.trim(),
      sort_order: locations.length,
      created_by: userId,
    })
    setSaving(false)
    if (saveError) return setError('장소를 추가하지 못했어요.')
    setNewName('')
    setNewDescription('')
  }

  const activateLocation = async location => {
    setSaving(true)
    setError('')
    const { error: roomError } = await supabase.rpc('set_room_current_location', { target_room_id: roomId, target_location_id: location.id })
    if (roomError) {
      setSaving(false)
      return setError('현재 장소를 변경하지 못했어요.')
    }
    const content = JSON.stringify({ locationId: location.id, name: location.name, description: location.description || '' })
    const { error: messageError } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      character_id: activeCharacter?.id || null,
      type: 'scene_transition',
      content,
    })
    setSaving(false)
    if (messageError) return setError('장면 전환 기록을 남기지 못했어요.')
    setCurrentLocationId(location.id)
    onSceneChange?.(location)
    onClose()
  }

  const deleteLocation = async location => {
    if (!window.confirm(`‘${location.name}’ 장소를 삭제할까요?`)) return
    const { error: deleteError } = await supabase.from('room_locations').delete().eq('id', location.id).eq('room_id', roomId)
    if (deleteError) setError('장소를 삭제하지 못했어요.')
  }

  const saveNote = async () => {
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.from('room_shared_notes').upsert({ room_id: roomId, content: note, updated_by: userId, updated_at: new Date().toISOString() })
    setSaving(false)
    setError(saveError ? '공유 메모를 저장하지 못했어요.' : '')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 180, maxWidth: 480, margin: '0 auto', background: `${t.bg}88`, backdropFilter: 'blur(8px)' }} onPointerDown={event => event.target === event.currentTarget && onClose()}>
      <section className="settings-page-drawer" style={{ position: 'absolute', inset: 0, left: '8%', display: 'flex', flexDirection: 'column', background: t.bg, borderLeft: `1px solid ${t.border}`, boxShadow: '-18px 0 42px rgba(0,0,0,.28)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 10px' }}>
          <strong style={{ flex: 1, color: t.theirText, fontSize: 16 }}>장면과 기록</strong>
          <button onClick={onClose} aria-label="닫기" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', background: 'transparent', color: t.subText }}><X size={20} /></button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: '0 14px 12px' }}>
          {[['locations', '장소', MapPin], ['notes', '공유 메모', StickyNote]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 9, borderRadius: 11, border: `1px solid ${tab === id ? t.point : t.border}`, background: tab === id ? `${t.point}22` : t.panel, color: tab === id ? t.point : t.subText }}><Icon size={15} />{label}</button>
          ))}
        </div>
        {error && <div style={{ margin: '0 14px 10px', padding: 9, borderRadius: 9, background: '#ef44441c', color: '#f87171', fontSize: 11 }}>{error}</div>}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 18px' }}>
          {tab === 'locations' ? (
            <>
              <div style={{ display: 'grid', gap: 7, padding: 10, marginBottom: 12, borderRadius: 13, border: `1px solid ${t.border}`, background: t.panel }}>
                <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="새 장소 이름" maxLength={80} style={{ padding: 9, borderRadius: 9, border: `1px solid ${t.border}`, background: t.bg, color: t.inputText, outline: 'none' }} />
                <input value={newDescription} onChange={event => setNewDescription(event.target.value)} placeholder="장면 설명 (선택)" maxLength={160} style={{ padding: 9, borderRadius: 9, border: `1px solid ${t.border}`, background: t.bg, color: t.inputText, outline: 'none' }} />
                <button disabled={saving || !newName.trim()} onClick={addLocation} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 9, border: 0, borderRadius: 9, background: t.point, color: '#fff' }}><Plus size={15} />장소 추가</button>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {locations.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: t.subText, fontSize: 12 }}>등록된 장소가 없어요.</div>}
                {locations.map(location => {
                  const current = location.id === currentLocationId
                  return <div key={location.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, border: `1px solid ${current ? t.point : t.border}`, background: current ? `${t.point}18` : t.panel }}>
                    <button disabled={saving} onClick={() => activateLocation(location)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', color: t.theirText }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>{current && <Check size={13} color={t.point} />}{location.name}</div>
                      {location.description && <div style={{ marginTop: 4, color: t.subText, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location.description}</div>}
                    </button>
                    <button onClick={() => deleteLocation(location)} aria-label="장소 삭제" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: t.subText }}><Trash2 size={14} /></button>
                  </div>
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', minHeight: '100%', flexDirection: 'column', gap: 9 }}>
              <div style={{ color: t.subText, fontSize: 11 }}>방에 참여한 모두가 같은 메모를 보고 수정할 수 있어요.</div>
              <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="인물 관계, 복선, 다음 장면에서 기억할 내용을 적어보세요." style={{ flex: 1, minHeight: 280, resize: 'none', padding: 12, borderRadius: 13, border: `1px solid ${t.border}`, background: t.panel, color: t.inputText, outline: 'none', lineHeight: 1.65 }} />
              <button disabled={saving} onClick={saveNote} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, border: 0, borderRadius: 10, background: t.point, color: '#fff' }}><Save size={15} />공유 메모 저장</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
