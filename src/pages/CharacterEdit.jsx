import { useEffect, useState } from 'react'
import { ChevronLeft, ImagePlus, Sparkles, Trash2 } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen'
import { Button, IconButton, TextArea, TextInput } from '../components/ui'
import { supabase, uploadFile, validateImageFile } from '../lib/supabase'
import { DEFAULT_THEME_ID, getTheme } from '../lib/themes'
import { useThemeVars } from '../lib/themeVars'
import { cropProfileImage } from '../lib/profileImageCrop'

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
  const [cropFile, setCropFile] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [cropProgress, setCropProgress] = useState(0)
  const [cropError, setCropError] = useState('')
  const [cropProcessing, setCropProcessing] = useState(false)
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
      setTheme(getTheme(profile?.theme_id || DEFAULT_THEME_ID))
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

  useThemeVars(theme)

  if (!theme || (!character && !notice)) return <LoadingScreen />

  const chooseImage = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      alert(error)
      event.target.value = ''
      return
    }
    setCropFile(file)
    setCropError('')
    setCropProgress(0)
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const confirmCrop = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    setCropProcessing(true)
    setCropError('')
    try {
      const file = await cropProfileImage(cropFile, cropSrc, croppedAreaPixels, setCropProgress)
      const validationError = validateImageFile(file)
      if (validationError) throw new Error(validationError)
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setCropFile(null)
      setShowCropper(false)
    } catch (error) {
      console.error('character image crop failed:', error)
      setCropError(error?.message || '이미지를 자르지 못했어요. 다른 이미지를 선택해 주세요.')
    } finally {
      setCropProcessing(false)
    }
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
    <div className="character-edit-page">
      <header className="character-edit-header">
        <IconButton onClick={() => navigate(-1)} label="뒤로" className="character-edit-back"><ChevronLeft size={22} /></IconButton>
        <div className="character-title character-grow">프로필 수정</div>
        <Button variant="ghost" onClick={save} disabled={saving || !character} className="character-edit-save">{saving ? '저장 중…' : '저장'}</Button>
      </header>

      <main className="character-edit-shell">
        {character && <>
          <label className="character-edit-photo">
            <img src={imagePreview || DEFAULT_AVATAR} alt="" className="squircle-media character-edit-photo-image" />
            <span className="character-edit-photo-caption"><ImagePlus size={14} /> 사진 변경</span>
            <input type="file" accept="image/*" onChange={chooseImage} />
          </label>

          <label className="character-edit-field">
            <span className="character-field-label">이름</span>
            <TextInput value={name} onChange={event => setName(event.target.value)} />
          </label>
          <label className="character-edit-field character-edit-field--description">
            <span className="character-field-label">설명</span>
            <TextArea value={description} onChange={event => setDescription(event.target.value)} rows={4} className="character-edit-description" />
          </label>

          <Button variant="ghost" onClick={() => navigate(`/characters/${characterId}/text-effects`)} className="character-edit-effects">
            <Sparkles size={17} className="character-accent-icon" />
            <span className="character-grow">채팅 등장 효과</span>
            <span className="character-field-label">설정</span>
          </Button>

          <section className="character-edit-frames">
            <div className="character-frames-title">입력 중 말하기 애니메이션</div>
            <div className="character-frames-copy">입 모양이 다른 이미지를 최대 4장 등록할 수 있어요.</div>
            <div className="character-frames-grid character-frames-grid--edit">
              {frames.map((frame, index) => (
                <div key={frame.id} className="character-frame">
                  <img src={frame.image_url} alt={`말하기 프레임 ${index + 1}`} className="character-media character-frame-media" />
                  <IconButton onClick={() => removeFrame(frame)} label={`말하기 프레임 ${index + 1} 삭제`} className="character-frame-delete">
                    <Trash2 size={11} />
                  </IconButton>
                </div>
              ))}
              {frames.length < 4 && (
                <label className="character-frame-add">
                  <span className="character-frame-plus">+</span>
                  <input type="file" accept="image/*" multiple disabled={frameLoading} onChange={addFrames} />
                </label>
              )}
            </div>
          </section>
        </>}
        {notice && <div role="status" className={`character-notice${notice.includes('못') ? ' is-error' : ''}`}>{notice}</div>}
      </main>
      {showCropper && <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !cropProcessing) { setShowCropper(false); setCropFile(null) } }} className="character-crop-backdrop">
        <section role="dialog" aria-modal="true" aria-labelledby="profile-crop-title" className="character-crop-panel">
          <h2 id="profile-crop-title" className="character-crop-title">프로필 사진 영역 선택</h2>
          <div className="character-crop-media">
            <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="rect" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)} />
          </div>
          <label className="character-crop-zoom">
            확대 조절
            <input aria-label="사진 확대" type="range" min={1} max={3} step={0.1} value={zoom} onChange={event => setZoom(Number(event.target.value))} className="character-crop-range" />
          </label>
          {cropFile?.type === 'image/gif' && <div className="character-crop-copy">선택 영역을 원본 해상도로 자르고 GIF 움직임을 유지해요. 잘라낸 파일도 5MB 이하여야 해요.</div>}
          {cropError && <div role="alert" className="character-crop-error">{cropError}</div>}
          <div className="character-actions">
            <Button variant="secondary" onClick={() => { if (!cropProcessing) { setShowCropper(false); setCropFile(null); setCropError('') } }} disabled={cropProcessing}>취소</Button>
            <Button onClick={confirmCrop} disabled={cropProcessing} className="character-crop-confirm">{cropProcessing ? `${cropFile?.type === 'image/gif' ? 'GIF' : '사진'} 처리 중 ${cropProgress}%` : '적용'}</Button>
          </div>
        </section>
      </div>}
    </div>
  )
}
