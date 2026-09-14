import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ListMusic, Music, Pause, Play, Plus, Repeat, Shuffle, SkipBack, SkipForward, Trash2, Volume2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function sharedPosition(state) {
  if (!state) return 0
  const base = Number(state.position_seconds) || 0
  return state.is_playing && state.started_at ? Math.max(0, base + (Date.now() - new Date(state.started_at).getTime()) / 1000) : base
}

function playbackPosition(state, duration) {
  const raw = sharedPosition(state)
  return duration > 0 ? Math.min(raw, duration) : raw
}

export default function SharedBackgroundAudio({ roomId, userId, theme, open, onClose }) {
  const [shared, setShared] = useState(null)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('idea-bgm-volume') ?? 0.45))
  const [error, setError] = useState('')
  const [needsGesture, setNeedsGesture] = useState(false)
  const [tab, setTab] = useState('player')
  const [tracks, setTracks] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [selectedTrackByPlaylist, setSelectedTrackByPlaylist] = useState({})
  const audioRef = useRef(null)
  const sharedRef = useRef(null)
  const t = theme

  const loadLibrary = useCallback(async () => {
    const [{ data: trackRows, error: trackError }, { data: playlistRows, error: playlistError }] = await Promise.all([
      supabase.from('background_audio_tracks').select('*').order('title'),
      supabase.from('room_audio_playlists').select('*, room_audio_playlist_items(*, background_audio_tracks(*))').eq('room_id', roomId).order('created_at'),
    ])
    if (trackError || playlistError) setError('플레이리스트를 불러오지 못했어요. 마이그레이션 적용 여부를 확인해주세요.')
    setTracks(trackRows || [])
    setPlaylists((playlistRows || []).map(playlist => ({
      ...playlist,
      room_audio_playlist_items: [...(playlist.room_audio_playlist_items || [])].sort((a, b) => a.sort_order - b.sort_order),
    })))
  }, [roomId])

  useEffect(() => { sharedRef.current = shared }, [shared])

  useEffect(() => {
    let active = true
    const loadShared = async () => {
      const { data, error: loadError } = await supabase.from('room_background_audio').select('*').eq('room_id', roomId).maybeSingle()
      if (!active) return
      if (loadError) setError('배경음 상태를 불러오지 못했어요.')
      else setShared(data || null)
    }
    loadShared()
    const libraryTimer = window.setTimeout(loadLibrary, 0)
    const channel = supabase
      .channel(`room-bgm-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_background_audio', filter: `room_id=eq.${roomId}` }, payload => setShared(payload.eventType === 'DELETE' ? null : payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_audio_playlists', filter: `room_id=eq.${roomId}` }, loadLibrary)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_audio_playlist_items' }, loadLibrary)
      .subscribe()
    return () => { active = false; window.clearTimeout(libraryTimer); supabase.removeChannel(channel) }
  }, [loadLibrary, roomId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !shared?.audio_url) return
    const sync = async (force = false) => {
      const desired = playbackPosition(shared, audio.duration)
      if (force || Math.abs(audio.currentTime - desired) > 2.5) audio.currentTime = desired
      setPosition(desired)
      if (shared.is_playing) {
        try { await audio.play(); setNeedsGesture(false) } catch { setNeedsGesture(true) }
      } else { audio.pause(); setNeedsGesture(false) }
    }
    if (audio.readyState >= 1) sync(true)
    else audio.addEventListener('loadedmetadata', () => sync(true), { once: true })
  }, [shared?.audio_url, shared?.is_playing, shared?.started_at, shared?.position_seconds])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = audioRef.current
      const current = sharedRef.current
      if (!audio || !current?.is_playing) return
      const desired = playbackPosition(current, audio.duration)
      if (Math.abs(audio.currentTime - desired) > 2.5) audio.currentTime = desired
      setPosition(audio.currentTime)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    localStorage.setItem('idea-bgm-volume', String(volume))
  }, [volume])

  const updateShared = async patch => {
    setError('')
    const { error: updateError } = await supabase.from('room_background_audio').update({ ...patch, updated_by: userId }).eq('room_id', roomId)
    if (updateError) setError('배경음 상태를 공유하지 못했어요.')
  }
  const togglePlayback = async () => {
    if (!shared?.audio_url) return
    const audio = audioRef.current
    if (shared.is_playing) await updateShared({ is_playing: false, position_seconds: audio?.currentTime || sharedPosition(shared), started_at: null })
    else await updateShared({ is_playing: true, position_seconds: audio?.currentTime || Number(shared.position_seconds) || 0, started_at: new Date().toISOString() })
  }
  const seek = async value => {
    const next = Number(value)
    if (audioRef.current) audioRef.current.currentTime = next
    setPosition(next)
    await updateShared({ position_seconds: next, started_at: shared?.is_playing ? new Date().toISOString() : null })
  }
  const advance = async direction => {
    if (!shared?.playlist_item_id) return
    const { error: advanceError } = await supabase.rpc('advance_room_playlist', { target_room_id: roomId, expected_item_id: shared.playlist_item_id, direction })
    if (advanceError) setError('다음 곡으로 이동하지 못했어요.')
  }
  const allowPlayback = async () => {
    try { audioRef.current.currentTime = playbackPosition(shared, audioRef.current.duration); await audioRef.current.play(); setNeedsGesture(false) }
    catch { setError('브라우저에서 오디오 재생을 허용해주세요.') }
  }
  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return
    const { error: createError } = await supabase.from('room_audio_playlists').insert({ room_id: roomId, name: newPlaylistName.trim(), created_by: userId })
    if (createError) return setError('플레이리스트를 만들지 못했어요.')
    setNewPlaylistName('')
    await loadLibrary()
  }
  const addTrack = async playlist => {
    const trackId = selectedTrackByPlaylist[playlist.id]
    if (!trackId) return
    const { error: addError } = await supabase.from('room_audio_playlist_items').insert({ playlist_id: playlist.id, track_id: trackId, sort_order: playlist.room_audio_playlist_items.length })
    if (addError) setError(addError.code === '23505' ? '이미 플레이리스트에 있는 음원이에요.' : '음원을 추가하지 못했어요.')
    else await loadLibrary()
  }
  const removeItem = async itemId => { await supabase.from('room_audio_playlist_items').delete().eq('id', itemId); await loadLibrary() }
  const moveItem = async (playlist, index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= playlist.room_audio_playlist_items.length) return
    const current = playlist.room_audio_playlist_items[index]
    const target = playlist.room_audio_playlist_items[targetIndex]
    await Promise.all([
      supabase.from('room_audio_playlist_items').update({ sort_order: target.sort_order }).eq('id', current.id),
      supabase.from('room_audio_playlist_items').update({ sort_order: current.sort_order }).eq('id', target.id),
    ])
    await loadLibrary()
  }
  const playItem = async itemId => {
    const { error: playError } = await supabase.rpc('play_room_playlist_item', { target_room_id: roomId, target_playlist_item_id: itemId, start_playing: true })
    if (playError) setError('음원을 재생하지 못했어요.')
    else setTab('player')
  }
  const updatePlaylist = async (playlistId, patch) => { await supabase.from('room_audio_playlists').update(patch).eq('id', playlistId); await loadLibrary() }
  const deletePlaylist = async playlist => {
    if (!window.confirm(`‘${playlist.name}’ 플레이리스트를 삭제할까요?`)) return
    await supabase.from('room_audio_playlists').delete().eq('id', playlist.id)
    await loadLibrary()
  }

  return <>
    <audio ref={audioRef} src={shared?.audio_url || undefined} loop={!shared?.playlist_id} preload="auto" onEnded={() => shared?.playlist_item_id && advance(1)} onLoadedMetadata={event => { setDuration(event.currentTarget.duration || 0); event.currentTarget.volume = volume }} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} />
    {needsGesture && shared?.is_playing && !open && <button onClick={allowPlayback} style={{ position: 'fixed', left: '50%', bottom: 'calc(82px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 115, padding: '9px 13px', borderRadius: 18, border: `1px solid ${t.border}`, background: `${t.panel}ee`, color: t.theirText }}><Play size={14} fill="currentColor" /> 재생 허용</button>}
    {open && <div onPointerDown={event => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 125, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.28)' }}>
      <section className="ui-slide-up" style={{ width: '100%', maxWidth: 480, maxHeight: '82vh', overflowY: 'auto', padding: '14px 16px calc(18px + env(safe-area-inset-bottom))', borderRadius: '22px 22px 0 0', border: `1px solid ${t.border}`, background: t.panel, boxShadow: '0 -18px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Music size={18} color={t.point} /><strong style={{ flex: 1, color: t.theirText, fontSize: 14 }}>공유 배경음</strong><button onClick={onClose} style={{ width: 34, height: 34, border: 0, background: 'none', color: t.subText }}><X size={18} /></button></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 }}>
          {[['player', '재생', Music], ['playlists', '플레이리스트', ListMusic]].map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 8, borderRadius: 9, border: `1px solid ${tab === id ? t.point : t.border}`, background: tab === id ? `${t.point}22` : t.bg, color: tab === id ? t.point : t.subText }}><Icon size={14} />{label}</button>)}
        </div>
        {tab === 'player' ? (shared?.audio_url ? <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <div style={{ color: t.theirText, fontSize: 13 }}>{shared.title || '배경음'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button disabled={!shared.playlist_item_id} onClick={() => advance(-1)} style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: 'transparent', color: t.subText }}><SkipBack size={16} fill="currentColor" /></button>
            <button onClick={needsGesture ? allowPlayback : togglePlayback} style={{ width: 42, height: 42, border: 0, borderRadius: '50%', background: t.point, color: '#fff' }}>{shared.is_playing && !needsGesture ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
            <button disabled={!shared.playlist_item_id} onClick={() => advance(1)} style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: 'transparent', color: t.subText }}><SkipForward size={16} fill="currentColor" /></button>
            <span style={{ width: 36, color: t.subText, fontSize: 10 }}>{formatTime(position)}</span><input type="range" min="0" max={duration || 1} step=".5" value={Math.min(position, duration || 1)} onChange={event => setPosition(Number(event.target.value))} onPointerUp={event => seek(event.currentTarget.value)} style={{ flex: 1, accentColor: t.point }} /><span style={{ width: 36, color: t.subText, fontSize: 10 }}>{formatTime(duration)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Volume2 size={15} color={t.subText} /><input type="range" min="0" max="1" step=".05" value={volume} onChange={event => setVolume(Number(event.target.value))} style={{ flex: 1, accentColor: t.point }} /><span style={{ color: t.subText, fontSize: 10 }}>{Math.round(volume * 100)}%</span></div>
        </div> : <div style={{ marginTop: 14, padding: 18, border: `1px dashed ${t.border}`, borderRadius: 13, color: t.subText, textAlign: 'center', fontSize: 11 }}>재생 중인 배경음이 없어요.</div>) : <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}><input value={newPlaylistName} onChange={event => setNewPlaylistName(event.target.value)} placeholder="새 플레이리스트 이름" style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 9, border: `1px solid ${t.border}`, background: t.bg, color: t.inputText }} /><button onClick={createPlaylist} style={{ width: 38, border: 0, borderRadius: 9, background: t.point, color: '#fff' }}><Plus size={16} /></button></div>
          {playlists.map(playlist => <section key={playlist.id} style={{ padding: 10, borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><strong style={{ flex: 1, color: t.theirText, fontSize: 12 }}>{playlist.name}</strong><button onClick={() => updatePlaylist(playlist.id, { shuffle_enabled: !playlist.shuffle_enabled })} style={{ width: 30, height: 30, border: 0, borderRadius: 8, background: playlist.shuffle_enabled ? `${t.point}25` : 'transparent', color: playlist.shuffle_enabled ? t.point : t.subText }}><Shuffle size={14} /></button><button onClick={() => updatePlaylist(playlist.id, { repeat_mode: playlist.repeat_mode === 'all' ? 'one' : playlist.repeat_mode === 'one' ? 'none' : 'all' })} style={{ width: 30, height: 30, border: 0, borderRadius: 8, background: playlist.repeat_mode !== 'none' ? `${t.point}25` : 'transparent', color: playlist.repeat_mode !== 'none' ? t.point : t.subText }}><Repeat size={14} /><span style={{ fontSize: 7 }}>{playlist.repeat_mode === 'one' ? '1' : ''}</span></button><button onClick={() => deletePlaylist(playlist)} style={{ width: 30, height: 30, border: 0, background: 'transparent', color: t.subText }}><Trash2 size={14} /></button></div>
            <div style={{ display: 'grid', gap: 5, marginTop: 7 }}>{playlist.room_audio_playlist_items.map((item, index) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 6, borderRadius: 8, background: t.panel }}><button onClick={() => playItem(item.id)} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: shared?.playlist_item_id === item.id ? t.point : t.theirText, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{item.background_audio_tracks?.title || '음원'}</button><button onClick={() => moveItem(playlist, index, -1)} disabled={index === 0} style={{ border: 0, background: 'none', color: t.subText }}><ChevronUp size={13} /></button><button onClick={() => moveItem(playlist, index, 1)} disabled={index === playlist.room_audio_playlist_items.length - 1} style={{ border: 0, background: 'none', color: t.subText }}><ChevronDown size={13} /></button><button onClick={() => removeItem(item.id)} style={{ border: 0, background: 'none', color: '#f87171' }}><X size={13} /></button></div>)}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 7 }}><select value={selectedTrackByPlaylist[playlist.id] || ''} onChange={event => setSelectedTrackByPlaylist(current => ({ ...current, [playlist.id]: event.target.value }))} style={{ flex: 1, minWidth: 0, padding: 7, borderRadius: 8, border: `1px solid ${t.border}`, background: t.panel, color: t.inputText }}><option value="">음원 선택</option>{tracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select><button onClick={() => addTrack(playlist)} style={{ width: 34, border: 0, borderRadius: 8, background: t.point, color: '#fff' }}><Plus size={14} /></button></div>
          </section>)}
          {playlists.length === 0 && <div style={{ padding: 22, color: t.subText, textAlign: 'center', fontSize: 11 }}>플레이리스트를 만들어 음원을 추가해보세요.</div>}
        </div>}
        <div style={{ marginTop: 9, color: t.subText, fontSize: 10 }}>재생 상태는 방 전체에 공유되고, 음량은 내 기기에만 적용돼요.</div>{error && <div style={{ marginTop: 8, color: '#ef7777', fontSize: 10 }}>{error}</div>}
      </section>
    </div>}
  </>
}
