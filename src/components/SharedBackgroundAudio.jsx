import { useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Volume2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function sharedPosition(state) {
  if (!state) return 0
  const base = Number(state.position_seconds) || 0
  if (!state.is_playing || !state.started_at) return base
  return Math.max(0, base + (Date.now() - new Date(state.started_at).getTime()) / 1000)
}

function playbackPosition(state, duration) {
  const raw = sharedPosition(state)
  return duration > 0 ? raw % duration : raw
}

export default function SharedBackgroundAudio({ roomId, userId, theme, open, onClose }) {
  const [shared, setShared] = useState(null)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('idea-bgm-volume') ?? 0.45))
  const [error, setError] = useState('')
  const [needsGesture, setNeedsGesture] = useState(false)
  const audioRef = useRef(null)
  const sharedRef = useRef(null)
  const t = theme

  useEffect(() => {
    sharedRef.current = shared
  }, [shared])

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: loadError } = await supabase.from('room_background_audio').select('*').eq('room_id', roomId).maybeSingle()
      if (!active) return
      if (loadError) setError('배경음 상태를 불러오지 못했습니다. 마이그레이션 적용 여부를 확인해주세요.')
      else setShared(data || null)
    }
    load()
    const channel = supabase
      .channel(`room-bgm-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_background_audio', filter: `room_id=eq.${roomId}` }, payload => {
        if (payload.eventType === 'DELETE') setShared(null)
        else setShared(payload.new)
      })
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !shared?.audio_url) return
    const sync = async (force = false) => {
      const desired = playbackPosition(shared, audio.duration)
      if (force || Math.abs(audio.currentTime - desired) > 2.5) audio.currentTime = desired
      setPosition(desired)
      if (shared.is_playing) {
        try {
          await audio.play()
          setNeedsGesture(false)
        } catch {
          setNeedsGesture(true)
        }
      } else {
        audio.pause()
        setNeedsGesture(false)
      }
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
    if (updateError) setError('배경음 상태를 공유하지 못했습니다. 다시 시도해주세요.')
  }

  const togglePlayback = async () => {
    if (!shared?.audio_url) return
    const audio = audioRef.current
    if (shared.is_playing) {
      await updateShared({ is_playing: false, position_seconds: audio?.currentTime || sharedPosition(shared), started_at: null })
    } else {
      const nextPosition = audio?.currentTime || Number(shared.position_seconds) || 0
      await updateShared({ is_playing: true, position_seconds: nextPosition, started_at: new Date().toISOString() })
    }
  }

  const seek = async value => {
    const next = Number(value)
    if (audioRef.current) audioRef.current.currentTime = next
    setPosition(next)
    await updateShared({ position_seconds: next, started_at: shared?.is_playing ? new Date().toISOString() : null })
  }

  const allowPlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.currentTime = playbackPosition(shared, audio.duration)
      await audio.play()
      setNeedsGesture(false)
    } catch {
      setError('브라우저에서 오디오 재생을 허용해주세요.')
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={shared?.audio_url || undefined}
        loop
        preload="auto"
        onLoadedMetadata={event => {
          setDuration(event.currentTarget.duration || 0)
          event.currentTarget.volume = volume
        }}
        onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      />

      {needsGesture && shared?.is_playing && !open && (
        <button onClick={allowPlayback} style={{ position: 'fixed', left: '50%', bottom: 'calc(82px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 115, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 18, border: `1px solid ${t.border}`, background: `${t.panel}ee`, color: t.theirText, backdropFilter: 'blur(14px)' }}>
          <Play size={14} fill="currentColor" /> 배경음 재생 허용
        </button>
      )}

      {open && (
        <div onPointerDown={event => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 125, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.28)' }}>
          <section className="ui-slide-up" style={{ width: '100%', maxWidth: 480, padding: '14px 16px calc(18px + env(safe-area-inset-bottom))', borderRadius: '22px 22px 0 0', border: `1px solid ${t.border}`, background: t.panel, boxShadow: '0 -18px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Music size={18} color={t.point} />
              <strong style={{ flex: 1, color: t.theirText, fontSize: 14 }}>공유 배경음</strong>
              <button onClick={onClose} aria-label="닫기" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', border: 0, background: 'none', color: t.subText }}><X size={18} /></button>
            </div>

            {shared?.audio_url ? (
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <div style={{ color: t.theirText, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shared.title || '배경음'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={needsGesture ? allowPlayback : togglePlayback} aria-label={shared.is_playing ? '일시정지' : '재생'} style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', background: t.point, color: '#fff' }}>
                    {shared.is_playing && !needsGesture ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>
                  <span style={{ width: 39, color: t.subText, fontSize: 10 }}>{formatTime(position)}</span>
                  <input type="range" min="0" max={duration || 1} step="0.5" value={Math.min(position, duration || 1)} onChange={event => setPosition(Number(event.target.value))} onPointerUp={event => seek(event.currentTarget.value)} onKeyUp={event => seek(event.currentTarget.value)} style={{ flex: 1, accentColor: t.point }} />
                  <span style={{ width: 39, textAlign: 'right', color: t.subText, fontSize: 10 }}>{formatTime(duration)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Volume2 size={15} color={t.subText} />
                  <input aria-label="개인 음량" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} style={{ flex: 1, accentColor: t.point }} />
                  <span style={{ width: 34, textAlign: 'right', color: t.subText, fontSize: 10 }}>{Math.round(volume * 100)}%</span>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', marginTop: 14, padding: 18, borderRadius: 13, border: `1px dashed ${t.border}`, background: t.bg, color: t.subText, textAlign: 'center', fontSize: 11 }}>이 방에 등록된 배경음이 없습니다.</div>
            )}
            <div style={{ marginTop: 9, color: t.subText, fontSize: 10, lineHeight: 1.55 }}>재생·일시정지·위치 이동은 방 전체에 공유되고, 음량은 내 기기에만 적용됩니다.</div>
            {error && <div role="alert" style={{ marginTop: 8, color: '#ef7777', fontSize: 10 }}>{error}</div>}
          </section>
        </div>
      )}
    </>
  )
}
