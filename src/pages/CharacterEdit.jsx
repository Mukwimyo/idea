import { useEffect, useState } from 'react'
import { ChevronLeft, ImagePlus, Sparkles, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen'
import { supabase, uploadFile, validateImageFile } from '../lib/supabase'
import { getTheme } from '../lib/themes'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

export default function CharacterEdit() {
  const { characterId } = useParams()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(null)
  const [userId, setUserId] = useState(null)
  const [character, setCharacter] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [frames, setFrames] = useState([])
  const [saving, setSaving] = useState(false)
  const [frameLoading, setFrameLoading] = useState(false)
  const [notice, setNotice] = useState('')

  const fetchFrames = async () => {
    const { data } = await supabase.from('character_talking_frames').select('*').eq('character_id', characterId).order('sort_order').order('created_at')
    setFrames(data || [])
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: found }] = await Promise.all([
        supabase.from('profiles').select('theme_id').eq('id', user.id).maybeSingle(),
        supabase.from('characters').select('*').eq('id', characterId).eq('user_id', user.id).maybeSingle(),
      ])
      if (!active) return
      setTheme(getTheme(profile?.theme_id || 'dark-purple'))
      setUserId(user.id)
      if (!found) {
        setNotice('캐릭터를 찾을 수 없어요.')
        return
      }
      setCharacter(found)
      setName(found.name)
      setDescription(found.description || '')
      setImagePreview(found.image_url || null)
      await fetchFrames()
    })()
    return () => { active = false }
  }, [characterId])

  if (!theme || (!character && !notice)) return <LoadingScreen />
  const t = theme

  const chooseImage = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      alert(error)
      event.target.value = ''
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!name.trim() || !character) return
    setSaving(true)
    setNotice('')
    let imageUrl = character.image_url
    try {
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        imageUrl = await uploadFile(imageFile, `avatars/${userId}/${Date.now()}.${ext}`)
      }
      const { error } = await supabase.from('characters').update({ name: name.trim(), description: description.trim(), image_url: imageUrl }).eq('id', characterId).eq('user_id', userId)
      if (error) throw error
      setCharacter(current => ({ ...current, name: name.trim(), description: description.trim(), image_url: imageUrl }))
      setImageFile(null)
      setNotice('프로필을 저장했어요.')
    } catch (error) {
      console.error('character update failed:', error.message)
      setNotice('프로필을 저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }

  const addFrames = async event => {
    const selected = Array.from(event.target.files || []).slice(0, Math.max(0, 4 - frames.length))
    event.target.value = ''
    if (selected.length === 0) return
    const invalid = selected.map(validateImageFile).find(Boolean)
    if (invalid) return alert(invalid)
    setFrameLoading(true)
    try {
      const rows = []
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index]
        const ext = file.name.split('.').pop()
        const imageUrl = await uploadFile(file, `talking-frames/${userId}/${characterId}/${Date.now()}-${index}.${ext}`)
        rows.push({ character_id: characterId, user_id: userId, image_url: imageUrl, sort_order: frames.length + index })
      }
      const { error } = await supabase.from('character_talking_frames').insert(rows)
      if (error) throw error
      await fetchFrames()
    } catch (error) {
      console.error('talking frame upload failed:', error.message)
      alert('말하기 프레임을 저장하지 못했어요.')
    } finally {
      setFrameLoading(false)
    }
  }

  const removeFrame = async frame => {
    const { error } = await supabase.from('character_talking_frames').delete().eq('id', frame.id).eq('user_id', userId)
    if (!error) setFrames(current => current.filter(item => item.id !== frame.id))
  }

  return (
    <div className="modern-surface-page character-edit-page" style={{ minHeight: '100dvh', background: t.bg, color: t.theirText }}>
      <header className="modern-page-header" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: `${t.bg}ee`, borderBottom: `1px solid ${t.border}`, backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="뒤로" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', border: 0, background: 'none', color: t.theirText }}><ChevronLeft size={22} /></button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 650 }}>프로필 수정</div>
        <button onClick={save} disabled={saving || !character} style={{ border: 0, background: 'none', color: t.point, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? '저장 중…' : '저장'}</button>
      </header>

      <main className="modern-page-shell" style={{ maxWidth: 480, margin: '0 auto', padding: '24px 18px 40px' }}>
        {character && <>
          <label style={{ display: 'grid', justifyItems: 'center', gap: 8, marginBottom: 24, cursor: 'pointer' }}>
            <img className="squircle-media" src={imagePreview || DEFAULT_AVATAR} alt="" style={{ width: 104, height: 104, objectFit: 'cover' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: t.point, fontSize: 11 }}><ImagePlus size={14} /> 사진 변경</span>
            <input type="file" accept="image/*" onChange={chooseImage} style={{ display: 'none' }} />
          </label>

          <label style={{ display: 'grid', gap: 7, marginBottom: 14 }}><span style={{ color: t.subText, fontSize: 11 }}>이름</span><input value={name} onChange={event => setName(event.target.value)} style={{ minHeight: 48, padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel, color: t.inputText, fontSize: 14 }} /></label>
          <label style={{ display: 'grid', gap: 7, marginBottom: 24 }}><span style={{ color: t.subText, fontSize: 11 }}>설명</span><textarea value={description} onChange={event => setDescription(event.target.value)} rows={4} style={{ padding: 12, border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel, color: t.inputText, fontSize: 13, resize: 'vertical' }} /></label>

          <button onClick={() => navigate(`/characters/${characterId}/text-effects`)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '15px 0', border: 0, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, background: 'none', color: t.theirText, textAlign: 'left', cursor: 'pointer' }}><Sparkles size={17} color={t.point} /><span style={{ flex: 1 }}>채팅 등장 효과</span><span style={{ color: t.subText, fontSize: 11 }}>설정</span></button>

          <section style={{ paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 650 }}>입력 중 말하기 애니메이션</div>
            <div style={{ marginTop: 4, color: t.subText, fontSize: 10 }}>입 모양이 다른 이미지를 최대 4장 등록할 수 있어요.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
              {frames.map((frame, index) => <div key={frame.id} style={{ position: 'relative', aspectRatio: '1 / 1' }}><img src={frame.image_url} alt={`말하기 프레임 ${index + 1}`} style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} /><button onClick={() => removeFrame(frame)} aria-label={`말하기 프레임 ${index + 1} 삭제`} style={{ position: 'absolute', top: 3, right: 3, width: 23, height: 23, display: 'grid', placeItems: 'center', padding: 0, border: 0, borderRadius: '50%', background: 'rgba(0,0,0,.65)', color: '#fff' }}><Trash2 size={11} /></button></div>)}
              {frames.length < 4 && <label style={{ aspectRatio: '1 / 1', display: 'grid', placeItems: 'center', border: `1px dashed ${t.border}`, borderRadius: 10, color: t.subText, cursor: frameLoading ? 'wait' : 'pointer', opacity: frameLoading ? 0.5 : 1 }}><span style={{ fontSize: 22 }}>+</span><input type="file" accept="image/*" multiple disabled={frameLoading} onChange={addFrames} style={{ display: 'none' }} /></label>}
            </div>
          </section>
        </>}
        {notice && <div role="status" style={{ marginTop: 18, color: notice.includes('못') ? '#f87171' : t.subText, fontSize: 11 }}>{notice}</div>}
      </main>
    </div>
  )
}
