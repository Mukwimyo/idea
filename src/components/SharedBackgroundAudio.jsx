import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ListMusic, Music, Pause, Play, Plus, Repeat, Shuffle, SkipBack, SkipForward, Trash2, Volume2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, IconButton, TextInput } from './ui'

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

export default function SharedBackgroundAudio({ roomId, userId, open, onClose }) {
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

  return (
    <>
      <audio ref={audioRef} src={shared?.audio_url || undefined} loop={!shared?.playlist_id} preload="auto" onEnded={() => shared?.playlist_item_id && advance(1)} onLoadedMetadata={event => { setDuration(event.currentTarget.duration || 0); event.currentTarget.volume = volume }} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} />
      {needsGesture && shared?.is_playing && !open && (
        <Button variant="secondary" className="shared-audio-allow" onClick={allowPlayback}><Play size={14} fill="currentColor" /> 재생 허용</Button>
      )}
      {open && (
        <div onPointerDown={event => event.target === event.currentTarget && onClose()} className="room-sheet-backdrop shared-audio-backdrop">
          <Card as="section" className="room-sheet shared-audio">
            <div className="room-panel-header">
              <Music size={18} />
              <strong className="room-panel-title">공유 배경음</strong>
              <IconButton type="button" label="닫기" className="room-panel-icon" onClick={onClose}><X size={18} /></IconButton>
            </div>
            <div className="room-panel-tabs shared-audio__tabs">
              {[['player', '재생', Music], ['playlists', '플레이리스트', ListMusic]].map(([id, label, Icon]) => (
                <Button key={id} variant="secondary" className="room-panel-tab" data-selected={tab === id} onClick={() => setTab(id)}>
                  <Icon size={14} />{label}
                </Button>
              ))}
            </div>
            {tab === 'player' ? (
              shared?.audio_url ? (
                <div className="room-panel-stack shared-audio__player">
                  <div className="shared-audio__track-title">{shared.title || '배경음'}</div>
                  <div className="room-panel-row shared-audio__transport">
                    <IconButton type="button" label="이전 곡" className="room-panel-icon" disabled={!shared.playlist_item_id} onClick={() => advance(-1)}><SkipBack size={16} fill="currentColor" /></IconButton>
                    <IconButton type="button" label={shared.is_playing && !needsGesture ? '일시 정지' : '재생'} className="room-panel-icon shared-audio__play" onClick={needsGesture ? allowPlayback : togglePlayback}>
                      {shared.is_playing && !needsGesture ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    </IconButton>
                    <IconButton type="button" label="다음 곡" className="room-panel-icon" disabled={!shared.playlist_item_id} onClick={() => advance(1)}><SkipForward size={16} fill="currentColor" /></IconButton>
                    <span className="room-panel-caption shared-audio__time">{formatTime(position)}</span>
                    <input className="room-panel-range" type="range" min="0" max={duration || 1} step=".5" value={Math.min(position, duration || 1)} onChange={event => setPosition(Number(event.target.value))} onPointerUp={event => seek(event.currentTarget.value)} />
                    <span className="room-panel-caption shared-audio__time">{formatTime(duration)}</span>
                  </div>
                  <div className="room-panel-row shared-audio__volume">
                    <Volume2 size={15} />
                    <input className="room-panel-range" type="range" min="0" max="1" step=".05" value={volume} onChange={event => setVolume(Number(event.target.value))} />
                    <span className="room-panel-caption">{Math.round(volume * 100)}%</span>
                  </div>
                </div>
              ) : (
                <div className="room-panel-empty shared-audio__empty">재생 중인 배경음이 없어요.</div>
              )
            ) : (
              <div className="room-panel-stack shared-audio__library">
                <div className="room-panel-row shared-audio__field">
                  <TextInput value={newPlaylistName} onChange={event => setNewPlaylistName(event.target.value)} placeholder="새 플레이리스트 이름" />
                  <IconButton type="button" label="플레이리스트 추가" className="room-panel-icon shared-audio__add" onClick={createPlaylist}><Plus size={16} /></IconButton>
                </div>
                {playlists.map(playlist => (
                  <Card as="section" key={playlist.id} className="room-panel-stack shared-audio__playlist">
                    <div className="room-panel-row shared-audio__playlist-header">
                      <strong>{playlist.name}</strong>
                      <IconButton type="button" label="셔플" className="room-panel-icon" active={playlist.shuffle_enabled} onClick={() => updatePlaylist(playlist.id, { shuffle_enabled: !playlist.shuffle_enabled })}><Shuffle size={14} /></IconButton>
                      <IconButton type="button" label="반복" className="room-panel-icon" active={playlist.repeat_mode !== 'none'} onClick={() => updatePlaylist(playlist.id, { repeat_mode: playlist.repeat_mode === 'all' ? 'one' : playlist.repeat_mode === 'one' ? 'none' : 'all' })}>
                        <Repeat size={14} /><span>{playlist.repeat_mode === 'one' ? '1' : ''}</span>
                      </IconButton>
                      <IconButton type="button" label="플레이리스트 삭제" className="room-panel-icon" onClick={() => deletePlaylist(playlist)}><Trash2 size={14} /></IconButton>
                    </div>
                    <div className="room-panel-stack shared-audio__items">
                      {playlist.room_audio_playlist_items.map((item, index) => (
                        <div key={item.id} className="room-panel-row shared-audio__item">
                          <Button variant="ghost" className="shared-audio__item-title" data-current={shared?.playlist_item_id === item.id} onClick={() => playItem(item.id)}>
                            <span>{item.background_audio_tracks?.title || '음원'}</span>
                          </Button>
                          <IconButton type="button" label="위로 이동" className="room-panel-icon" onClick={() => moveItem(playlist, index, -1)} disabled={index === 0}><ChevronUp size={13} /></IconButton>
                          <IconButton type="button" label="아래로 이동" className="room-panel-icon" onClick={() => moveItem(playlist, index, 1)} disabled={index === playlist.room_audio_playlist_items.length - 1}><ChevronDown size={13} /></IconButton>
                          <IconButton type="button" label="음원 삭제" className="room-panel-icon shared-audio__remove" onClick={() => removeItem(item.id)}><X size={13} /></IconButton>
                        </div>
                      ))}
                    </div>
                    <div className="room-panel-row shared-audio__field">
                      <select className="ui-input" value={selectedTrackByPlaylist[playlist.id] || ''} onChange={event => setSelectedTrackByPlaylist(current => ({ ...current, [playlist.id]: event.target.value }))}>
                        <option value="">음원 선택</option>
                        {tracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}
                      </select>
                      <IconButton type="button" label="음원 추가" className="room-panel-icon shared-audio__add" onClick={() => addTrack(playlist)}><Plus size={14} /></IconButton>
                    </div>
                  </Card>
                ))}
                {playlists.length === 0 && <div className="room-panel-empty">플레이리스트를 만들어 음원을 추가해보세요.</div>}
              </div>
            )}
            <div className="room-panel-caption shared-audio__notice">재생 상태는 방 전체에 공유되고, 음량은 내 기기에만 적용돼요.</div>
            {error && <div className="room-panel-error shared-audio__notice">{error}</div>}
          </Card>
        </div>
      )}
    </>
  )
}
