import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { THEMES, getTheme } from '../lib/themes'
import { ChevronLeft, ChevronRight, LogOut, Users } from 'lucide-react'

function ThemePreview({ t }) {
  return (
    <div style={{ width: 140, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${t.border}`, flexShrink: 0 }}>
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

  const t = getTheme(myThemeId)
  const darkThemes = THEMES.filter(th => th.dark)
  const lightThemes = THEMES.filter(th => !th.dark)

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'sans-serif', transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingTop: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={22} color={t.subText} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 500, color: t.theirText }}>설정</div>
          {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: t.subText }}>저장 중...</div>}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>내 테마 (전역)</div>
          <div style={{ fontSize: 11, color: t.subText, marginBottom: 12, opacity: 0.7 }}>모든 채팅방에 기본 적용돼요. 채팅방별로 따로 설정할 수도 있어요.</div>

          <div style={{ fontSize: 11, color: t.subText, marginBottom: 8, opacity: 0.6 }}>다크</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {darkThemes.map(th => (
              <div key={th.id} onClick={() => saveTheme(th.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: myThemeId === th.id ? `2.5px solid ${th.point}` : `1.5px solid ${th.border}`, transition: 'border 0.15s' }}>
                  <ThemePreview t={th} />
                </div>
                <div style={{ fontSize: 10, color: myThemeId === th.id ? t.point : t.subText, fontWeight: myThemeId === th.id ? 500 : 400 }}>{th.name}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: t.subText, marginBottom: 8, opacity: 0.6 }}>라이트</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lightThemes.map(th => (
              <div key={th.id} onClick={() => saveTheme(th.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: myThemeId === th.id ? `2.5px solid ${th.point}` : `1.5px solid ${th.border}`, transition: 'border 0.15s' }}>
                  <ThemePreview t={th} />
                </div>
                <div style={{ fontSize: 10, color: myThemeId === th.id ? th.point : t.subText, fontWeight: myThemeId === th.id ? 500 : 400 }}>{th.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 0.5, background: t.border, marginBottom: 28 }} />

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: t.subText, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>계정</div>
          <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `0.5px solid ${t.border}`, cursor: 'pointer' }} onClick={() => navigate('/characters')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={15} color={t.subText} />
                <div style={{ fontSize: 13, color: t.theirText }}>캐릭터 관리</div>
              </div>
              <ChevronRight size={16} color={t.subText} />
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => supabase.auth.signOut()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogOut size={15} color='#f87171' />
                <div style={{ fontSize: 13, color: '#f87171' }}>로그아웃</div>
              </div>
              <ChevronRight size={16} color={t.subText} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}