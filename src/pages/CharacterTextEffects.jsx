import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import TextEffectConfigurator from '../components/TextEffectConfigurator'
import LoadingScreen from '../components/LoadingScreen'
import { supabase } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { normalizeTextEffectSettings } from '../features/messages/textEffectSettings'

export default function CharacterTextEffects() {
  const { characterId } = useParams()
  const navigate = useNavigate()
  const [character, setCharacter] = useState(null)
  const [settings, setSettings] = useState(null)
  const [theme, setTheme] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data, error }] = await Promise.all([
        supabase.from('profiles').select('theme_id').eq('id', user.id).maybeSingle(),
        supabase.from('characters').select('*').eq('id', characterId).eq('user_id', user.id).maybeSingle(),
      ])
      if (!active) return
      setTheme(getTheme(profile?.theme_id || 'dark-purple'))
      if (error || !data) {
        setNotice('캐릭터 정보를 불러오지 못했어요.')
        return
      }
      setCharacter(data)
      setSettings(normalizeTextEffectSettings(data.text_effect_settings))
    })()
    return () => { active = false }
  }, [characterId])

  if (!theme || (!character && !notice)) return <LoadingScreen />

  const save = async () => {
    setSaving(true)
    setNotice('')
    const { error } = await supabase.from('characters').update({ text_effect_settings: settings }).eq('id', characterId)
    setSaving(false)
    setNotice(error ? '설정을 저장하지 못했어요.' : '이 캐릭터의 대사 연출을 저장했어요.')
  }

  return (
    <div style={{ minHeight: '100dvh', background: theme.bg, color: theme.theirText }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${theme.border}`, background: `${theme.bg}ee`, backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="뒤로" style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, border: 0, background: 'none', color: theme.theirText }}><ChevronLeft size={20} /></button>
        <div><div style={{ fontSize: 15, fontWeight: 600 }}>{character?.name || '캐릭터'} 대사 연출</div><div style={{ marginTop: 2, color: theme.subText, fontSize: 10 }}>새로 보내는 대사부터 적용됩니다</div></div>
      </div>
      <main style={{ width: 'min(100%, 640px)', margin: '0 auto', padding: '18px 16px 34px', boxSizing: 'border-box' }}>
        {character && <TextEffectConfigurator value={settings} onChange={setSettings} theme={theme} />}
        {notice && <div role="status" style={{ marginTop: 13, color: notice.includes('못했') ? '#f87171' : theme.subText, fontSize: 11 }}>{notice}</div>}
        {character && <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: 18, padding: 12, border: 0, borderRadius: 11, background: theme.point, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.55 : 1 }}>{saving ? '저장 중…' : '대사 연출 저장'}</button>}
      </main>
    </div>
  )
}
