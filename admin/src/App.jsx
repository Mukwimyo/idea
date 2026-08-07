import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, DoorOpen, HardDrive, LogOut, Music, Pause, Play, RefreshCw, Search, Trash2, Upload, Users } from 'lucide-react'
import { supabase } from './supabase'

const MAX_AUDIO_SIZE = 20 * 1024 * 1024
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm'])

const formatBytes = value => {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const formatDuration = value => {
  const seconds = Math.max(0, Math.round(Number(value) || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const readDuration = file => new Promise(resolve => {
  const audio = document.createElement('audio')
  const url = URL.createObjectURL(file)
  audio.preload = 'metadata'
  audio.onloadedmetadata = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : null
    URL.revokeObjectURL(url)
    resolve(duration)
  }
  audio.onerror = () => {
    URL.revokeObjectURL(url)
    resolve(null)
  }
  audio.src = url
})

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (loginError) return setError('이메일 또는 비밀번호를 확인해주세요.')
    onAuthenticated(data.session)
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">IDEA</div>
        <h1>관리자 콘솔</h1>
        <p>등록된 관리자 계정만 접근할 수 있습니다.</p>
        <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="이메일" autoComplete="username" required />
        <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="비밀번호" autoComplete="current-password" required />
        <button className="primary" disabled={loading}>{loading ? '확인 중…' : '로그인'}</button>
        {error && <div className="error">{error}</div>}
      </form>
    </main>
  )
}

function Dashboard({ stats, loading, onRefresh }) {
  const cards = [
    ['사용자', Number(stats.users || 0).toLocaleString(), <Users size={18} />],
    ['대화방', Number(stats.rooms || 0).toLocaleString(), <DoorOpen size={18} />],
    ['메시지', Number(stats.messages || 0).toLocaleString(), <BarChart3 size={18} />],
    ['등록 음원', Number(stats.tracks || 0).toLocaleString(), <Music size={18} />],
  ]
  return (
    <section>
      <div className="section-head"><div><h2>대시보드</h2><p>현재 IDEA 서비스 사용량입니다.</p></div><button className="icon-button" onClick={onRefresh} aria-label="새로고침"><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
      <div className="stat-grid">{cards.map(([label, value, icon]) => <article className="stat-card" key={label}><span>{icon}{label}</span><strong>{value}</strong></article>)}</div>
      <div className="usage-grid">
        <article className="usage-card"><div><HardDrive size={17} /> Database</div><strong>{formatBytes(stats.database_bytes)}</strong><progress value={Number(stats.database_bytes || 0)} max={500 * 1024 ** 2} /><small>Free 한도 500MB</small></article>
        <article className="usage-card"><div><Upload size={17} /> File Storage</div><strong>{formatBytes(stats.storage_bytes)}</strong><progress value={Number(stats.storage_bytes || 0)} max={1024 ** 3} /><small>Free 한도 1GB</small></article>
      </div>
    </section>
  )
}

function AudioManager({ tracks, rooms, userId, onChanged }) {
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  const upload = async file => {
    if (!file) return
    setMessage('')
    if (!AUDIO_TYPES.has(file.type)) return setMessage('MP3, M4A/AAC, OGG, WebM 파일만 업로드할 수 있습니다.')
    if (file.size > MAX_AUDIO_SIZE) return setMessage('음원은 20MB 이하만 업로드할 수 있습니다.')
    setUploading(true)
    const duration = await readDuration(file)
    const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'audio'
    const path = `bgm/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('idea-uploads').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      setUploading(false)
      return setMessage(`업로드 실패: ${uploadError.message}`)
    }
    const { data: urlData } = supabase.storage.from('idea-uploads').getPublicUrl(path)
    const { error: insertError } = await supabase.from('background_audio_tracks').insert({
      title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
      storage_path: path,
      audio_url: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      duration_seconds: duration,
      created_by: userId,
    })
    setUploading(false)
    if (insertError) return setMessage(`음원 정보 저장 실패: ${insertError.message}`)
    setTitle('')
    setMessage('음원을 등록했습니다.')
    onChanged()
  }

  const preview = track => {
    if (playingId === track.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = track.audio_url
    audioRef.current.play().then(() => setPlayingId(track.id)).catch(() => setMessage('미리듣기를 시작하지 못했습니다.'))
    audioRef.current.onended = () => setPlayingId(null)
  }

  const remove = async track => {
    if (rooms.some(room => room.track_id === track.id)) return setMessage('방에 배정된 음원은 먼저 배정을 해제해주세요.')
    if (!window.confirm(`${track.title} 음원을 삭제할까요?`)) return
    const { data: path, error } = await supabase.rpc('admin_delete_background_audio_track', { target_track_id: track.id })
    if (error) return setMessage(`삭제 실패: ${error.message}`)
    if (path) await supabase.storage.from('idea-uploads').remove([path])
    setMessage('음원을 삭제했습니다.')
    onChanged()
  }

  return (
    <section>
      <div className="section-head"><div><h2>배경음 관리</h2><p>관리자만 음원을 등록하고 삭제할 수 있습니다.</p></div></div>
      <div className="upload-card">
        <input value={title} onChange={event => setTitle(event.target.value)} placeholder="표시 제목 (선택)" />
        <button className="primary" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload size={16} />{uploading ? '업로드 중…' : '음원 선택'}</button>
        <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.m4a,.aac,.ogg,.webm" hidden onChange={event => { upload(event.target.files?.[0]); event.target.value = '' }} />
      </div>
      {message && <div className={message.includes('실패') || message.includes('이하') || message.includes('먼저') ? 'error notice' : 'notice'}>{message}</div>}
      <div className="list">{tracks.map(track => <article className="track-card" key={track.id}>
        <button className="round-button" onClick={() => preview(track)}>{playingId === track.id ? <Pause size={16} /> : <Play size={16} />}</button>
        <div className="grow"><strong>{track.title}</strong><small>{Number(track.file_size) > 0 ? formatBytes(track.file_size) : '용량 정보 없음'} · {Number(track.duration_seconds) > 0 ? formatDuration(track.duration_seconds) : '재생시간 정보 없음'} · {rooms.filter(room => room.track_id === track.id).length}개 방</small></div>
        <button className="icon-button danger" onClick={() => remove(track)} aria-label="삭제"><Trash2 size={16} /></button>
      </article>)}</div>
      {tracks.length === 0 && <div className="empty">등록된 배경음이 없습니다.</div>}
    </section>
  )
}

function RoomManager({ rooms, tracks, onChanged }) {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const filtered = useMemo(() => rooms.filter(room => room.room_name.toLowerCase().includes(query.toLowerCase())), [rooms, query])

  const assign = async (roomId, trackId) => {
    const { error } = await supabase.rpc('admin_assign_room_background_audio', { target_room_id: roomId, target_track_id: trackId || null })
    setMessage(error ? `배정 실패: ${error.message}` : '방 배경음 설정을 저장했습니다.')
    if (!error) onChanged()
  }

  return (
    <section>
      <div className="section-head"><div><h2>대화방 관리</h2><p>방 현황을 확인하고 배경음을 배정합니다.</p></div></div>
      <label className="search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="방 이름 검색" /></label>
      {message && <div className={message.includes('실패') ? 'error notice' : 'notice'}>{message}</div>}
      <div className="list">{filtered.map(room => <article className="room-card" key={room.room_id}>
        <div className="grow"><strong>{room.room_name}</strong><small>멤버 {room.member_count}명 · 메시지 {Number(room.message_count).toLocaleString()}개</small></div>
        <select value={room.track_id || ''} onChange={event => assign(room.room_id, event.target.value)}>
          <option value="">배경음 없음</option>
          {tracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}
        </select>
      </article>)}</div>
      {filtered.length === 0 && <div className="empty">표시할 대화방이 없습니다.</div>}
    </section>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState({})
  const [tracks, setTracks] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const verify = async nextSession => {
    setSession(nextSession)
    if (!nextSession) {
      setAuthorized(false)
      setChecking(false)
      return
    }
    try {
      const { data, error: verifyError } = await Promise.race([
        supabase.rpc('is_idea_admin', { check_user_id: nextSession.user.id }),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('관리자 권한 API 응답 시간 초과')), 8000)),
      ])
      setAuthorized(data === true && !verifyError)
      setError(
        verifyError
          ? `관리자 권한 확인 실패: ${verifyError.message}`
          : data === true
            ? ''
            : '관리자 권한이 등록되지 않은 계정입니다.',
      )
    } catch (verifyException) {
      setAuthorized(false)
      setError(`${verifyException.message}. 관리자 마이그레이션과 네트워크 상태를 확인해주세요.`)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    let initialCheckStarted = false
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') initialCheckStarted = true
      window.setTimeout(() => verify(nextSession), 0)
    })
    const fallback = window.setTimeout(() => {
      if (initialCheckStarted) return
      setChecking(false)
      setError('인증 세션을 불러오지 못했습니다. 페이지를 새로고침해주세요.')
    }, 8000)
    return () => {
      window.clearTimeout(fallback)
      listener.subscription.unsubscribe()
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!authorized) return
    setLoading(true)
    const [statsResult, tracksResult, roomsResult] = await Promise.all([
      supabase.rpc('admin_dashboard_stats'),
      supabase.from('background_audio_tracks').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_rooms'),
    ])
    setLoading(false)
    const firstError = statsResult.error || tracksResult.error || roomsResult.error
    if (firstError) return setError(`관리자 데이터를 불러오지 못했습니다: ${firstError.message}`)
    setStats(statsResult.data || {})
    setTracks(tracksResult.data || [])
    setRooms(roomsResult.data || [])
    setError('')
  }, [authorized])

  useEffect(() => {
    if (!authorized) return undefined
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [authorized, loadData])

  if (checking) return <main className="center-message">관리자 권한 확인 중…</main>
  if (!session) return <><Login onAuthenticated={verify} />{error && <div className="auth-diagnostic">{error}</div>}</>
  if (!authorized) return <main className="center-message"><div><h1>접근할 수 없습니다</h1><p>{error}</p><button className="primary" onClick={() => supabase.auth.signOut()}>로그아웃</button></div></main>

  const tabs = [
    ['dashboard', '현황', BarChart3],
    ['audio', '배경음', Music],
    ['rooms', '대화방', DoorOpen],
  ]

  return (
    <div className="app-shell">
      <header><div><div className="brand small">IDEA</div><span>관리자 콘솔</span></div><button className="icon-button" onClick={() => supabase.auth.signOut()} aria-label="로그아웃"><LogOut size={17} /></button></header>
      {error && <div className="error global-error">{error}</div>}
      <main>
        {tab === 'dashboard' && <Dashboard stats={stats} loading={loading} onRefresh={loadData} />}
        {tab === 'audio' && <AudioManager tracks={tracks} rooms={rooms} userId={session.user.id} onChanged={loadData} />}
        {tab === 'rooms' && <RoomManager rooms={rooms} tracks={tracks} onChanged={loadData} />}
      </main>
      <nav>{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
    </div>
  )
}
