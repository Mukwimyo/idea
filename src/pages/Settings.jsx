import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_THEME_ID, THEMES, getTheme } from '../lib/themes'
import { getImpactHapticsEnabled, isImpactHapticsSupported, setImpactHapticsEnabled, vibrateImpact } from '../lib/haptics'
import { useThemeVars } from '../lib/themeVars'
import { ChevronLeft, ChevronRight, LogOut, Users, Bell, BellOff, CircleHelp } from 'lucide-react'
import { supabase, subscribePush, unsubscribePush } from '../lib/supabase'
import { Button, Card, IconButton, Toggle } from '../components/ui'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import { clearPendingMessages } from '../features/messages/pendingMessageStore'

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
    <span className="settings-preview" style={{ borderColor: t.border }}>
      <span
        className="settings-preview__header"
        style={{ background: t.panel, borderColor: t.border, color: t.theirText }}>
        <span className="settings-preview__icon" style={{ background: t.point }} />
        이데아
      </span>
      <span className="settings-preview__chat" style={{ background: t.bg }}>
        <span className="settings-preview__row">
          <span
            className="settings-preview__avatar settings-preview__avatar--their"
            style={{ background: t.theirBubble, borderColor: t.theirBorder }}
          />
          <span
            className="settings-preview__bubble settings-preview__bubble--their"
            style={{ background: t.theirBubble, borderColor: t.theirBorder, color: t.theirText }}>
            기다렸어. <span style={{ color: t.subText }}>(눈 맞추며)</span>
          </span>
        </span>
        <span className="settings-preview__narration" style={{ color: t.narrColor }}>
          · · · 안개 · · ·
        </span>
        <span className="settings-preview__row settings-preview__row--mine">
          <span className="settings-preview__avatar" style={{ background: t.myBubble }} />
          <span
            className="settings-preview__bubble settings-preview__bubble--mine"
            style={{ background: t.myBubble, color: t.myText }}>
            뭐야 이게. <span style={{ color: t.myAct }}>(물러서며)</span>
          </span>
        </span>
      </span>
    </span>
  )
}

function ThemeOption({ theme, selected, onClick }) {
  return (
    <Button variant="ghost" className="settings-theme-option" aria-pressed={selected} onClick={onClick}>
      <span
        className="settings-theme-option__frame"
        style={{ borderColor: selected ? theme.point : theme.border }}
        aria-hidden="true">
        <ThemePreview t={theme} />
      </span>
      <span className="settings-theme-option__name">{theme.name}</span>
    </Button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [myThemeId, setMyThemeId] = useState(() => localStorage.getItem('idea-theme-id') || DEFAULT_THEME_ID)
  const [saving, setSaving] = useState(false)
  const [myFontId, setMyFontId] = useState('sans')
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('idea-font-scale') || 1))
  const [pushEnabled, setPushEnabled] = useState(false)
  const [showEntering, setShowEntering] = useState(true)
  const [impactHapticsEnabled, setImpactHapticsChecked] = useState(getImpactHapticsEnabled)
  const [showMessageTime, setShowMessageTime] = useState(true)
  const [showEditedLabel, setShowEditedLabel] = useState(true)
  const [topCharacterPicker, setTopCharacterPicker] = useState(false)
  const [hideMessageBubbles, setHideMessageBubbles] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const [{ data }, { data: messageDisplaySetting }] = await Promise.all([
      supabase.from('profiles').select('theme_id, font_id, font_scale, show_entering').eq('id', user.id).single(),
      supabase.from('profiles').select('show_message_time, show_edited_label, top_character_picker, hide_message_bubbles').eq('id', user.id).maybeSingle(),
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
    if (messageDisplaySetting?.show_message_time !== undefined) setShowMessageTime(messageDisplaySetting.show_message_time)
    if (messageDisplaySetting?.show_edited_label !== undefined) setShowEditedLabel(messageDisplaySetting.show_edited_label)
    if (messageDisplaySetting?.top_character_picker !== undefined) setTopCharacterPicker(messageDisplaySetting.top_character_picker)
    if (messageDisplaySetting?.hide_message_bubbles !== undefined) setHideMessageBubbles(messageDisplaySetting.hide_message_bubbles)

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
    localStorage.setItem('idea-theme-id', id)
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({ theme_id: id }).eq('id', user.id)
    setSaving(false)
    showToast(error ? '테마를 저장하지 못했어요.' : '테마가 저장됐어요.', error ? 'error' : 'success')
  }

  const saveFont = async id => {
    setMyFontId(id)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({ font_id: id }).eq('id', user.id)
    document.body.style.fontFamily = FONTS.find(f => f.id === id)?.family || 'sans-serif'
    showToast(error ? '폰트를 저장하지 못했어요.' : '폰트가 저장됐어요.', error ? 'error' : 'success')
  }

  const saveFontScale = async value => {
    const scale = Number(value)
    setFontScale(scale)
    localStorage.setItem('idea-font-scale', String(scale))
    document.documentElement.style.setProperty('--idea-font-scale', String(scale))
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({ font_scale: scale }).eq('id', user.id)
    showToast(error ? '글자 크기를 저장하지 못했어요.' : '글자 크기가 저장됐어요.', error ? 'error' : 'success')
  }

  const togglePush = async () => {
    setPushLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (pushEnabled) {
      await unsubscribePush(user.id)
      setPushEnabled(false)
      showToast('푸시 알림을 껐어요.')
    } else {
      const result = await subscribePush(user.id)
      if (result.success) {
        setPushEnabled(true)
        showToast('푸시 알림을 켰어요.')
      } else if (result.reason === 'denied') {
        alert('알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.')
        showToast('알림 권한이 필요해요.', 'error')
      } else if (result.reason === 'unsupported') {
        alert('이 브라우저는 푸시 알림을 지원하지 않아요.')
        showToast('푸시 알림을 지원하지 않는 브라우저예요.', 'error')
      }
    }
    setPushLoading(false)
  }

  const handleLogout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) await unsubscribePush(user.id)
    if (user) clearPendingMessages(localStorage, user.id)
    await supabase.auth.signOut()
  }

  const closeSettings = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => navigate(-1), 220)
  }

  const t = getTheme(myThemeId)
  useThemeVars(t)
  const darkThemes = THEMES.filter(th => th.dark)
  const lightThemes = THEMES.filter(th => !th.dark)

  return (
    <div className={`settings-page-drawer settings-page app-settings-page${closing ? ' is-closing' : ''}`}>
      <Toast toast={toast} />
      <div className="settings-shell">
        <div className="settings-header">
          <IconButton type="button" label="뒤로 가기" className="settings-back" onClick={closeSettings}>
            <ChevronLeft size={22} />
          </IconButton>
          <div className="settings-title">설정</div>
          {saving && <div className="settings-saving">저장 중...</div>}
        </div>

        <div className="settings-section">
          <div className="settings-section-title">내 테마 (전역)</div>
          <div className="settings-section-description">
            모든 채팅방에 기본 적용돼요. 채팅방별로 따로 설정할 수도 있어요.
          </div>
          <div className="settings-theme-label">다크</div>
          <div className="settings-theme-grid settings-theme-grid--dark">
            {darkThemes.map(th => (
              <ThemeOption key={th.id} theme={th} selected={myThemeId === th.id} onClick={() => saveTheme(th.id)} />
            ))}
          </div>
          <div className="settings-theme-label">라이트</div>
          <div className="settings-theme-grid">
            {lightThemes.map(th => (
              <ThemeOption key={th.id} theme={th} selected={myThemeId === th.id} onClick={() => saveTheme(th.id)} />
            ))}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-section">
          <div className="settings-section-title">폰트</div>
          <div className="settings-font-list">
            {FONTS.map(f => (
              <Button
                key={f.id}
                variant="ghost"
                className="settings-row settings-font-option"
                aria-pressed={myFontId === f.id}
                style={{ fontFamily: f.family }}
                onClick={() => saveFont(f.id)}>
                <span>{f.name}</span>
                <span className="settings-font-option__sample">가나다 ABC 123</span>
              </Button>
            ))}
          </div>
          <div className="settings-row settings-font-scale-row">
            <div className="settings-font-scale-label">
              <div>채팅 글자 크기</div>
              <div className="settings-font-scale-value">{Math.round(fontScale * 100)}%</div>
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
              className="settings-font-scale"
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">알림</div>
          <div className="settings-row">
            <div className="settings-row-label">
              {pushEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              <div>새 메시지 푸시 알림</div>
            </div>
            <Toggle
              label="새 메시지 푸시 알림"
              checked={pushEnabled}
              className={pushLoading ? 'settings-switch--loading' : undefined}
              onClick={togglePush}
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">채팅방</div>
          <div className="settings-row">
            <div>입장 룰렛 애니메이션</div>
            <Toggle
              label="입장 룰렛 애니메이션"
              checked={showEntering}
              onChange={async next => {
                setShowEntering(next)
                const {
                  data: { user },
                } = await supabase.auth.getUser()
                const { error } = await supabase.from('profiles').update({ show_entering: next }).eq('id', user.id)
                showToast(error ? '입장 애니메이션 설정을 저장하지 못했어요.' : '입장 애니메이션 설정이 저장됐어요.', error ? 'error' : 'success')
              }}
            />
          </div>
          {isImpactHapticsSupported() && (
            <div className="settings-row">
              <div>
                <div>충격 연출 진동</div>
                <div className="settings-row-description">충격 연출이 재생될 때 휴대폰을 진동해요 (Android)</div>
              </div>
              <Toggle
                label="충격 연출 진동"
                checked={impactHapticsEnabled}
                onChange={next => {
                  setImpactHapticsChecked(next)
                  setImpactHapticsEnabled(next)
                  if (next) vibrateImpact()
                }}
              />
            </div>
          )}
          <div className="settings-row">
            <div>
              <div>캐릭터 선택 위치</div>
              <div className="settings-row-description">켜면 채팅방 상단 사람 아이콘에서 바꿔요. 끄면 기존 하단 버튼을 사용해요.</div>
            </div>
            <Toggle
              label="상단바 캐릭터 선택 사용"
              checked={topCharacterPicker}
              onChange={async next => {
                setTopCharacterPicker(next)
                const { data: { user } } = await supabase.auth.getUser()
                const { error } = await supabase.from('profiles').update({ top_character_picker: next }).eq('id', user.id)
                showToast(error ? '캐릭터 선택 위치를 저장하지 못했어요.' : '캐릭터 선택 위치가 저장됐어요.', error ? 'error' : 'success')
                if (error) setTopCharacterPicker(!next)
              }}
            />
          </div>
          <div className="settings-row">
            <div>
              <div>메시지 시간 표시</div>
              <div className="settings-row-description">같은 분의 마지막 메시지에만 표시돼요.</div>
            </div>
            <Toggle
              label="메시지 시간 표시"
              checked={showMessageTime}
              onChange={async next => {
                setShowMessageTime(next)
                const {
                  data: { user },
                } = await supabase.auth.getUser()
                const { error } = await supabase.from('profiles').update({ show_message_time: next }).eq('id', user.id)
                showToast(error ? '시간 표시 설정을 저장하지 못했어요.' : '시간 표시 설정이 저장됐어요.', error ? 'error' : 'success')
              }}
            />
          </div>
          <div className="settings-row">
            <div>
              <div>수정됨 표시</div>
              <div className="settings-row-description">편집한 메시지 옆의 수정 이력을 표시해요.</div>
            </div>
            <Toggle
              label="수정됨 표시"
              checked={showEditedLabel}
              onChange={async next => {
                setShowEditedLabel(next)
                const {
                  data: { user },
                } = await supabase.auth.getUser()
                const { error } = await supabase.from('profiles').update({ show_edited_label: next }).eq('id', user.id)
                showToast(error ? '수정됨 표시 설정을 저장하지 못했어요.' : '수정됨 표시 설정이 저장됐어요.', error ? 'error' : 'success')
              }}
            />
          </div>
          <div className="settings-row">
            <div>
              <div>말풍선 배경 숨기기</div>
              <div className="settings-row-description">켜면 모든 대화방에서 말풍선 배경색을 투명하게 표시해요.</div>
            </div>
            <Toggle
              label="말풍선 배경 숨기기"
              checked={hideMessageBubbles}
              onChange={async next => {
                setHideMessageBubbles(next)
                const { data: { user } } = await supabase.auth.getUser()
                const { error } = await supabase.from('profiles').update({ hide_message_bubbles: next }).eq('id', user.id)
                showToast(error ? '말풍선 설정을 저장하지 못했어요.' : '말풍선 설정이 저장됐어요.', error ? 'error' : 'success')
                if (error) setHideMessageBubbles(!next)
              }}
            />
          </div>
        </div>

        <div className="settings-account">
          <div className="settings-section-title">계정</div>
          <Card className="settings-account-card">
            <Button variant="ghost" block className="settings-account-action" onClick={() => navigate('/characters')}>
              <span className="settings-row-label">
                <Users size={15} />
                캐릭터 관리
              </span>
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="ghost"
              block
              className="settings-account-action settings-account-action--danger"
              onClick={handleLogout}>
              <span className="settings-row-label">
                <LogOut size={15} />
                로그아웃
              </span>
              <ChevronRight size={16} />
            </Button>
            <Button variant="ghost" block className="settings-account-action" onClick={() => navigate('/help')}>
              <span className="settings-row-label">
                <CircleHelp size={15} />
                앱 사용법
              </span>
              <ChevronRight size={16} />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
