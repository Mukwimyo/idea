import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { THEMES, getTheme } from '../lib/themes'
import { ChevronLeft, ChevronRight, LogOut, Users, Bell, BellOff, CircleHelp } from 'lucide-react'
import { supabase, subscribePush, unsubscribePush } from '../lib/supabase'

const FONTS = [
  { id: 'sans', name: '기본', family: 'sans-serif' },
  { id: 'godo-b', name: '고도체 B', family: 'GodoB' },
  { id: 'godo-m', name: '고도체 M', family: 'GodoM' },
  { id: 'pretendard', name: '프리텐다드', family: 'Pretendard' },
  { id: 'nanum-gothic', name: '나눔고딕', family: 'Nanum Gothic' },
  { id: 'nanum-myeongjo', name: '나눔명조', family: 'Nanum Myeongjo' },
  { id: 'noto-serif', name: '본명조', family: 'Noto Serif KR' },
  { id: 'maru-buri', name: '마루부리', family: 'MaruBuri' },
  { id: 'jeju-myeongjo', name: '제주명조', family: 'Jeju Myeongjo' },
  { id: 'aggro', name: '어그로체', family: 'SBAggroB' },
]

function ThemePreview({ t }) {
  return (
    <div
      style={{
        width: 140,
        borderRadius: 10,
        overflow: 'hidden',
        border: `1.5px solid ${t.border}`,
        flexShrink: 0,
      }}>
      <div
        style={{
          background: t.panel,
          padding: '5px 7px',
          borderBottom: `0.5px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: t.point,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontSize: 8,
            fontWeight: 500,
            color: t.theirText,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}>
          이데아
        </div>
      </div>
      <div
        style={{
          background: t.bg,
          padding: '5px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: t.theirBubble,
              border: `0.5px solid ${t.theirBorder}`,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              background: t.theirBubble,
              border: `0.5px solid ${t.theirBorder}`,
              borderRadius: '2px 7px 7px 7px',
              padding: '3px 6px',
              fontSize: 8,
              color: t.theirText,
              lineHeight: 1.4,
            }}>
            기다렸어. <span style={{ fontSize: 7, color: t.subText }}>(눈 맞추며)</span>
          </div>
        </div>
        <div
          style={{
            textAlign: 'center',
            fontSize: 7,
            color: t.narrColor,
            fontStyle: 'italic',
          }}>
          · · · 안개 · · ·
        </div>
        <div
          style={{
            display: 'flex',
            gap: 3,
            alignItems: 'flex-end',
            flexDirection: 'row-reverse',
          }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: t.myBubble,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              background: t.myBubble,
              borderRadius: '7px 2px 7px 7px',
              padding: '3px 6px',
              fontSize: 8,
              color: t.myText,
              lineHeight: 1.4,
            }}>
            뭐야 이게. <span style={{ fontSize: 7, color: t.myAct }}>(물러서며)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const [myThemeId, setMyThemeId] = useState('dark-purple')
  const [saving, setSaving] = useState(false)
  const [myFontId, setMyFontId] = useState('sans')
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('idea-font-scale') || 1))
  const [pushEnabled, setPushEnabled] = useState(false)
  const [showEntering, setShowEntering] = useState(true)
  const [showMessageTime, setShowMessageTime] = useState(true)
  const [pushLoading, setPushLoading] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const [{ data }, { data: messageTimeSetting }] = await Promise.all([
      supabase.from('profiles').select('theme_id, font_id, font_scale, show_entering').eq('id', user.id).single(),
      supabase.from('profiles').select('show_message_time').eq('id', user.id).maybeSingle(),
    ])
    if (data?.theme_id) setMyThemeId(data.theme_id)
    if (data?.font_id) setMyFontId(data.font_id)
    if (data?.font_scale) {
      const scale = Number(data.font_scale)
      setFontScale(scale)
      localStorage.setItem('idea-font-scale', String(scale))
      document.documentElement.style.setProperty('--idea-font-scale', String(scale))
    }
    if (data?.show_entering !== undefined) setShowEntering(data.show_entering)
    if (messageTimeSetting?.show_message_time !== undefined) setShowMessageTime(messageTimeSetting.show_message_time)

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/idea/sw.js')
      if (registration) {
        const sub = await registration.pushManager.getSubscription()
        setPushEnabled(!!sub)
      }
    }
  }

  const saveTheme = async id => {
    setMyThemeId(id)
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ theme_id: id }).eq('id', user.id)
    setSaving(false)
  }

  const saveFont = async id => {
    setMyFontId(id)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ font_id: id }).eq('id', user.id)
    document.body.style.fontFamily = FONTS.find(f => f.id === id)?.family || 'sans-serif'
  }

  const saveFontScale = async value => {
    const scale = Number(value)
    setFontScale(scale)
    localStorage.setItem('idea-font-scale', String(scale))
    document.documentElement.style.setProperty('--idea-font-scale', String(scale))
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ font_scale: scale }).eq('id', user.id)
  }

  const togglePush = async () => {
    setPushLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (pushEnabled) {
      await unsubscribePush(user.id)
      setPushEnabled(false)
    } else {
      const result = await subscribePush(user.id)
      if (result.success) {
        setPushEnabled(true)
      } else if (result.reason === 'denied') {
        alert('알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.')
      } else if (result.reason === 'unsupported') {
        alert('이 브라우저는 푸시 알림을 지원하지 않아요.')
      }
    }
    setPushLoading(false)
  }

  const handleLogout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) await unsubscribePush(user.id)
    await supabase.auth.signOut()
  }

  const closeSettings = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => navigate(-1), 220)
  }

  const t = getTheme(myThemeId)
  const darkThemes = THEMES.filter(th => th.dark)
  const lightThemes = THEMES.filter(th => !th.dark)

  return (
    <div
      className={`settings-page-drawer${closing ? ' is-closing' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        minHeight: '100dvh',
        overflowY: 'auto',
        background: t.bg,
        transition: 'background 0.3s',
      }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 24,
            paddingTop: 8,
          }}>
          <button
            onClick={closeSettings}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}>
            <ChevronLeft size={22} color={t.subText} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 500, color: t.theirText }}>설정</div>
          {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: t.subText }}>저장 중...</div>}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              color: t.subText,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}>
            내 테마 (전역)
          </div>
          <div
            style={{
              fontSize: 11,
              color: t.subText,
              marginBottom: 12,
              opacity: 0.7,
            }}>
            모든 채팅방에 기본 적용돼요. 채팅방별로 따로 설정할 수도 있어요.
          </div>

          <div
            style={{
              fontSize: 11,
              color: t.subText,
              marginBottom: 8,
              opacity: 0.6,
            }}>
            다크
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}>
            {darkThemes.map(th => (
              <div
                key={th.id}
                onClick={() => saveTheme(th.id)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                }}>
                <div
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: myThemeId === th.id ? `2.5px solid ${th.point}` : `1.5px solid ${th.border}`,
                    transition: 'border 0.15s',
                  }}>
                  <ThemePreview t={th} />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: myThemeId === th.id ? t.point : t.subText,
                    fontWeight: myThemeId === th.id ? 500 : 400,
                  }}>
                  {th.name}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 11,
              color: t.subText,
              marginBottom: 8,
              opacity: 0.6,
            }}>
            라이트
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lightThemes.map(th => (
              <div
                key={th.id}
                onClick={() => saveTheme(th.id)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                }}>
                <div
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: myThemeId === th.id ? `2.5px solid ${th.point}` : `1.5px solid ${th.border}`,
                    transition: 'border 0.15s',
                  }}>
                  <ThemePreview t={th} />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: myThemeId === th.id ? th.point : t.subText,
                    fontWeight: myThemeId === th.id ? 500 : 400,
                  }}>
                  {th.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 0.5, background: t.border, marginBottom: 28 }} />

        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              color: t.subText,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}>
            폰트
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FONTS.map(f => (
              <div
                key={f.id}
                onClick={() => saveFont(f.id)}
                style={{
                  background: t.panel,
                  border: myFontId === f.id ? `1.5px solid ${t.point}` : `0.5px solid ${t.border}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <span
                  style={{
                    fontSize: 14,
                    fontFamily: f.family,
                    color: t.theirText,
                  }}>
                  {f.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: f.family,
                    color: t.subText,
                  }}>
                  가나다 ABC 123
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, border: `0.5px solid ${t.border}`, background: t.panel }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: t.theirText }}>채팅 글자 크기</div>
              <div style={{ fontSize: 12, color: t.subText }}>{Math.round(fontScale * 100)}%</div>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={fontScale}
              onChange={event => {
                const scale = Number(event.target.value)
                setFontScale(scale)
                localStorage.setItem('idea-font-scale', String(scale))
                document.documentElement.style.setProperty('--idea-font-scale', String(scale))
              }}
              onPointerUp={event => saveFontScale(event.currentTarget.value)}
              onKeyUp={event => saveFontScale(event.currentTarget.value)}
              aria-label="채팅 글자 크기"
              style={{ width: '100%', accentColor: t.point }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              color: t.subText,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}>
            알림
          </div>
          <div
            style={{
              background: t.panel,
              border: `0.5px solid ${t.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pushEnabled ? <Bell size={15} color={t.subText} /> : <BellOff size={15} color={t.subText} />}
              <div style={{ fontSize: 13, color: t.theirText }}>새 메시지 푸시 알림</div>
            </div>
            <div
              onClick={togglePush}
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                cursor: pushLoading ? 'wait' : 'pointer',
                transition: 'background 0.2s',
                background: pushEnabled ? t.point : t.border,
                position: 'relative',
                flexShrink: 0,
                opacity: pushLoading ? 0.5 : 1,
              }}>
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: pushEnabled ? 20 : 3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>채팅방</div>
          <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: t.theirText }}>입장 룰렛 애니메이션</div>
            <div
              onClick={async () => {
                const next = !showEntering
                setShowEntering(next)
                const {
                  data: { user },
                } = await supabase.auth.getUser()
                await supabase.from('profiles').update({ show_entering: next }).eq('id', user.id)
              }}
              style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s', background: showEntering ? t.point : t.border, position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: showEntering ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
          <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '12px 14px', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: t.theirText }}>메시지 시간 표시</div>
              <div style={{ fontSize: 10, color: t.subText, marginTop: 2 }}>같은 분의 마지막 메시지에만 표시돼요.</div>
            </div>
            <div
              onClick={async () => {
                const next = !showMessageTime
                setShowMessageTime(next)
                const {
                  data: { user },
                } = await supabase.auth.getUser()
                await supabase.from('profiles').update({ show_message_time: next }).eq('id', user.id)
              }}
              style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s', background: showMessageTime ? t.point : t.border, position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: showMessageTime ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              color: t.subText,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}>
            계정
          </div>
          <div
            style={{
              background: t.panel,
              border: `0.5px solid ${t.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}>
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `0.5px solid ${t.border}`,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/characters')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={15} color={t.subText} />
                <div style={{ fontSize: 13, color: t.theirText }}>캐릭터 관리</div>
              </div>
              <ChevronRight size={16} color={t.subText} />
            </div>
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={handleLogout}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogOut size={15} color="#f87171" />
                <div style={{ fontSize: 13, color: '#f87171' }}>로그아웃</div>
              </div>
              <ChevronRight size={16} color={t.subText} />
            </div>
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: `0.5px solid ${t.border}`,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/help')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircleHelp size={15} color={t.subText} />
                <div style={{ fontSize: 13, color: t.theirText }}>앱 사용법</div>
              </div>
              <ChevronRight size={16} color={t.subText} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
