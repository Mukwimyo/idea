import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { THEMES, getTheme } from '../lib/themes'

function ThemePreview({ t, size = 'md' }) {
  const w = size === 'sm' ? 80 : 140
  return (
    <div style={{ width: w, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${t.border}`, flexShrink: 0 }}>
      <div style={{ background: t.panel, padding: '5px 7px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.point, flexShrink: 0 }} />
        <div style={{ fontSize: 8, fontWeight: 500, color: t.theirText, overflow: 'hidden', whiteSpace: 'nowrap' }}>이데아</div>
      </div>
      <div style={{ background: t.bg, padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.theirBubble, border: `0.5px solid ${t.theirBorder}`, flexShrink: 0 }} />
          <div style={{ background: t.theirBubble, border: `0.5px solid ${t.theirBorder}`, borderRadius: '2px 7px 7px 7px', padding: '3px 6px', fontSize: 8, color: t.theirText, lineHeight: 1.4 }}>
            기다렸어. <span style={{ fontSize: 7, color: t.subText }}>(눈 맞추며)</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 7, color: t.narrColor, fontStyle: 'italic' }}>· · · 안개 · · ·</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', flexDirection: 'row-reverse' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.myBubble, flexShrink: 0 }} />
          <div style={{ background: t.myBubble, borderRadius: '7px 2px 7px 7px', padding: '3px 6px', fontSize: 8, color: t.myText, lineHeight: 1.4 }}>
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

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
    if (data?.theme_id) setMyThemeId(data.theme_id)
  }

  const saveTheme = async (id) => {
    setMyThemeId(id)
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ theme_id: id }).eq('id', user.id)
    setSaving(false)
  }

  const darkThemes = THEMES.filter(t => t.dark)
  const lightThemes = THEMES.filter(t => !t.dark)

  return (
    <div style={{ minHeight: '100vh', background: getTheme(myThemeId).bg, fontFamily: 'sans-serif', transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingTop: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: getTheme(myThemeId).subText, fontSize: 20, cursor: 'pointer', padding: 0 }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 500, color: getTheme(myThemeId).theirText }}>설정</div>
          {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: getTheme(myThemeId).subText }}>저장 중...</div>}
        </div>

        {/* 섹션: 앱 전역 테마 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: getTheme(myThemeId).subText, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>내 테마 (전역)</div>
          <div style={{ fontSize: 11, color: getTheme(myThemeId).subText, marginBottom: 12, opacity: 0.7 }}>모든 채팅방에 기본 적용돼요. 채팅방별로 따로 설정할 수도 있어요.</div>

          {/* 다크 */}
          <div style={{ fontSize: 11, color: getTheme(myThemeId).subText, marginBottom: 8, opacity: 0.6 }}>다크</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {darkThemes.map(t => (
              <div key={t.id} onClick={() => saveTheme(t.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: myThemeId === t.id ? `2.5px solid ${t.point}` : `1.5px solid ${t.border}`, transition: 'border 0.15s' }}>
                  <ThemePreview t={t} />
                </div>
                <div style={{ fontSize: 10, color: myThemeId === t.id ? getTheme(myThemeId).point : getTheme(myThemeId).subText, fontWeight: myThemeId === t.id ? 500 : 400 }}>{t.name}</div>
              </div>
            ))}
          </div>

          {/* 라이트 */}
          <div style={{ fontSize: 11, color: getTheme(myThemeId).subText, marginBottom: 8, opacity: 0.6 }}>라이트</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lightThemes.map(t => (
              <div key={t.id} onClick={() => saveTheme(t.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: myThemeId === t.id ? `2.5px solid ${t.point}` : `1.5px solid ${t.border}`, transition: 'border 0.15s' }}>
                  <ThemePreview t={t} />
                </div>
                <div style={{ fontSize: 10, color: myThemeId === t.id ? t.point : getTheme(myThemeId).subText, fontWeight: myThemeId === t.id ? 500 : 400 }}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 구분선 */}
        <div style={{ height: 0.5, background: getTheme(myThemeId).border, marginBottom: 28 }} />

        {/* 섹션: 앞으로 추가할 설정들 자리 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: getTheme(myThemeId).subText, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>계정</div>
          <div style={{ background: getTheme(myThemeId).panel, border: `0.5px solid ${getTheme(myThemeId).border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `0.5px solid ${getTheme(myThemeId).border}` }}>
              <div style={{ fontSize: 13, color: getTheme(myThemeId).theirText }}>캐릭터 관리</div>
              <button onClick={() => navigate('/characters')} style={{ background: 'none', border: 'none', color: getTheme(myThemeId).subText, fontSize: 16, cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: '#f87171' }}>로그아웃</div>
              <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: getTheme(myThemeId).subText, fontSize: 16, cursor: 'pointer' }}>›</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}