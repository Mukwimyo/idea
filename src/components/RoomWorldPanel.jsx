import { useEffect, useState } from 'react'
import { Check, MapPin, Plus, Save, StickyNote, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createClientMessageId, sendRoomMessage } from '../features/messages/messageApi'
import { Button, Card, IconButton, TextArea, TextInput } from './ui'

export default function RoomWorldPanel({ open, initialTab = 'locations', roomId, userId, activeCharacter, onClose, onSceneChange }) {
  const [tab, setTab] = useState(initialTab)
  const [locations, setLocations] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [currentLocationId, setCurrentLocationId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let active = true
    const load = async () => {
      const [{ data: placeRows, error: placeError }, { data: roomRow }, { data: noteRow, error: noteError }, { data: playlistRows }] = await Promise.all([
        supabase.from('room_locations').select('*').eq('room_id', roomId).order('sort_order').order('created_at'),
        supabase.from('rooms').select('current_location_id').eq('id', roomId).single(),
        supabase.from('room_shared_notes').select('content').eq('room_id', roomId).maybeSingle(),
        supabase.from('room_audio_playlists').select('id, name').eq('room_id', roomId).order('created_at'),
      ])
      if (!active) return
      if (placeError || noteError) setError('장소와 메모를 불러오지 못했어요. 마이그레이션 적용 여부를 확인해주세요.')
      setLocations(placeRows || [])
      setPlaylists(playlistRows || [])
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
    let messageError = null
    try {
      await sendRoomMessage(supabase, {
        room_id: roomId,
        client_message_id: createClientMessageId(),
        character_id: activeCharacter?.id || null,
        type: 'scene_transition',
        content,
      })
    } catch (error) {
      messageError = error
    }
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

  const connectLocationPlaylist = async (location, playlistId) => {
    const { error: connectError } = await supabase.from('room_locations').update({ background_audio_playlist_id: playlistId || null }).eq('id', location.id).eq('room_id', roomId)
    if (connectError) setError('장소의 배경음을 연결하지 못했어요.')
    else setLocations(current => current.map(item => item.id === location.id ? { ...item, background_audio_playlist_id: playlistId || null } : item))
  }

  const saveNote = async () => {
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.from('room_shared_notes').upsert({ room_id: roomId, content: note, updated_by: userId, updated_at: new Date().toISOString() })
    setSaving(false)
    setError(saveError ? '공유 메모를 저장하지 못했어요.' : '')
  }

  return (
    <div className="room-world-backdrop" onPointerDown={event => event.target === event.currentTarget && onClose()}>
      <section className="room-world-panel">
        <header className="room-panel-header room-world-panel__header">
          <strong className="room-panel-title">장면과 기록</strong>
          <IconButton type="button" label="닫기" className="room-panel-icon" onClick={onClose}><X size={20} /></IconButton>
        </header>
        <div className="room-panel-tabs room-world-panel__tabs">
          {[['locations', '장소', MapPin], ['notes', '공유 메모', StickyNote]].map(([id, label, Icon]) => (
            <Button key={id} variant="secondary" className="room-panel-tab" data-selected={tab === id} onClick={() => setTab(id)}>
              <Icon size={15} />{label}
            </Button>
          ))}
        </div>
        {error && <div className="room-panel-error room-world-panel__error">{error}</div>}
        <div className="room-world-panel__body">
          {tab === 'locations' ? (
            <>
              <Card className="room-panel-stack room-world-panel__form">
                <TextInput value={newName} onChange={event => setNewName(event.target.value)} placeholder="새 장소 이름" maxLength={80} />
                <TextInput value={newDescription} onChange={event => setNewDescription(event.target.value)} placeholder="장면 설명 (선택)" maxLength={160} />
                <Button disabled={saving || !newName.trim()} onClick={addLocation}><Plus size={15} />장소 추가</Button>
              </Card>
              <div className="room-panel-stack">
                {locations.length === 0 && <div className="room-panel-empty">등록된 장소가 없어요.</div>}
                {locations.map(location => {
                  const current = location.id === currentLocationId
                  return (
                    <Card key={location.id} className="room-panel-stack room-world-panel__location" data-current={current}>
                      <div className="room-panel-row">
                        <Button variant="ghost" className="room-world-panel__activate" disabled={saving} onClick={() => activateLocation(location)}>
                          <span>{current && <Check size={13} />}{location.name}</span>
                          {location.description && <small>{location.description}</small>}
                        </Button>
                        <IconButton type="button" label="장소 삭제" className="room-panel-icon" onClick={() => deleteLocation(location)}><Trash2 size={14} /></IconButton>
                      </div>
                      <select className="ui-input" value={location.background_audio_playlist_id || ''} onChange={event => connectLocationPlaylist(location, event.target.value)}>
                        <option value="">연결된 배경음 없음</option>
                        {playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
                      </select>
                    </Card>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="room-world-panel__notes">
              <div className="room-panel-caption">방에 참여한 모두가 같은 메모를 보고 수정할 수 있어요.</div>
              <TextArea value={note} onChange={event => setNote(event.target.value)} placeholder="인물 관계, 복선, 다음 장면에서 기억할 내용을 적어보세요." />
              <Button disabled={saving} onClick={saveNote}><Save size={15} />공유 메모 저장</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
