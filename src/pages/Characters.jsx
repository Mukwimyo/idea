import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, uploadFile, validateImageFile } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { ChevronLeft, X, RotateCcw, Search, ArrowUp, ArrowDown, Check, ArrowDownAZ, GripVertical } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProfileImageModal from '../components/ProfileImageModal'

const DEFAULT_CHARACTER_COLOR = '#AFA9EC'
const DEFAULT_CHARACTER_TEXT_COLOR = '#26215C'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

function SortableCard({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 2 : 1, opacity: isDragging ? 0.72 : 1 }} {...attributes}>
      {children({ listeners })}
    </div>
  )
}

export default function Characters() {
  const { roomId } = useParams()
  const [chars, setChars] = useState([])
  const [userId, setUserId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roomName, setRoomName] = useState('')
  const [roomCharacterIds, setRoomCharacterIds] = useState([])
  const [roomPoolSaving, setRoomPoolSaving] = useState(false)
  const [roomPoolSaved, setRoomPoolSaved] = useState(false)
  const [alphabeticalView, setAlphabeticalView] = useState(false)
  const [profilePreview, setProfilePreview] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarLetter, setAvatarLetter] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [archivedChars, setArchivedChars] = useState([])
  const [theme, setTheme] = useState(null)

  const [editingChar, setEditingChar] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAvatarLetter, setEditAvatarLetter] = useState('')
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)

  const [showCropper, setShowCropper] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  // 편집 중인 캐릭터용도 추가
  const [editShowCropper, setEditShowCropper] = useState(false)
  const [editCropSrc, setEditCropSrc] = useState(null)
  const [editCrop, setEditCrop] = useState({ x: 0, y: 0 })
  const [editZoom, setEditZoom] = useState(1)
  const [editCroppedAreaPixels, setEditCroppedAreaPixels] = useState(null)

  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }))

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
    const resolvedTheme = getTheme(data?.theme_id || 'dark-purple')
    setTheme(resolvedTheme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme.panel)
    if (roomId) {
      const { data: room } = await supabase.from('rooms').select('name').eq('id', roomId).single()
      setRoomName(room?.name || '')
    }
    fetchChars(user.id)
  }

  const fetchChars = async uid => {
    const {
      data: { user },
    } = uid ? { data: { user: { id: uid } } } : await supabase.auth.getUser()
    const { data } = await supabase.from('characters').select().eq('user_id', user.id).eq('is_archived', false).order('sort_order').order('created_at')
    if (!data) return
    setChars(data)
    if (roomId) {
      const { data: roomCharacters } = await supabase.from('room_characters').select('character_id, sort_order').eq('room_id', roomId).eq('user_id', user.id).order('sort_order')
      const configuredIds = (roomCharacters || []).map(item => item.character_id).filter(id => data.some(character => character.id === id))
      setRoomCharacterIds(configuredIds.length > 0 ? configuredIds : data.map(character => character.id))
    }
  }

  const persistGlobalOrder = async orderedCharacters => {
    setChars(orderedCharacters)
    const results = await Promise.all(orderedCharacters.map((character, index) => supabase.from('characters').update({ sort_order: index }).eq('id', character.id).eq('user_id', userId)))
    if (results.some(result => result.error)) {
      alert('캐릭터 순서를 저장하지 못했어요.')
      fetchChars(userId)
    }
  }

  const moveGlobalCharacter = (characterId, direction) => {
    const currentIndex = chars.findIndex(character => character.id === characterId)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= chars.length) return
    const next = [...chars]
    ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
    persistGlobalOrder(next)
  }

  const toggleRoomCharacter = characterId => {
    setRoomPoolSaved(false)
    setRoomCharacterIds(current => {
      if (!current.includes(characterId)) return [...current, characterId]
      if (current.length === 1) {
        alert('방에서 사용할 캐릭터를 최소 1명 선택해 주세요.')
        return current
      }
      return current.filter(id => id !== characterId)
    })
  }

  const moveRoomCharacter = (characterId, direction) => {
    setRoomPoolSaved(false)
    setRoomCharacterIds(current => {
      const currentIndex = current.indexOf(characterId)
      const targetIndex = currentIndex + direction
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
      return next
    })
  }

  const handleGlobalDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || alphabeticalView) return
    const oldIndex = chars.findIndex(character => character.id === active.id)
    const newIndex = chars.findIndex(character => character.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    persistGlobalOrder(arrayMove(chars, oldIndex, newIndex))
  }

  const handleRoomDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || alphabeticalView) return
    setRoomPoolSaved(false)
    setRoomCharacterIds(current => {
      const oldIndex = current.indexOf(active.id)
      const newIndex = current.indexOf(over.id)
      if (oldIndex < 0 || newIndex < 0) return current
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  const saveRoomCharacterPool = async () => {
    if (!roomId || !userId || roomCharacterIds.length === 0) return
    setRoomPoolSaving(true)
    setRoomPoolSaved(false)
    const { error: deleteError } = await supabase.from('room_characters').delete().eq('room_id', roomId).eq('user_id', userId)
    if (deleteError) {
      alert('방 캐릭터 목록을 저장하지 못했어요.')
      setRoomPoolSaving(false)
      return
    }
    const rows = roomCharacterIds.map((characterId, index) => ({
      room_id: roomId,
      user_id: userId,
      character_id: characterId,
      sort_order: index,
    }))
    const { error: insertError } = await supabase.from('room_characters').insert(rows)
    setRoomPoolSaving(false)
    if (insertError) {
      alert('방 캐릭터 목록을 저장하지 못했어요.')
      return
    }
    setRoomPoolSaved(true)
  }

  const fetchArchived = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data } = await supabase.from('characters').select().eq('user_id', user.id).eq('is_archived', true)
    if (data) setArchivedChars(data)
  }

  const restoreChar = async id => {
    await supabase.from('characters').update({ is_archived: false, sort_order: chars.length }).eq('id', id)
    fetchChars()
    fetchArchived()
  }

  const handleImageChange = e => {
    const file = e.target.files[0]
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) {
      alert(validationError)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleEditImageChange = e => {
    const file = e.target.files[0]
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) {
      alert(validationError)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setEditCropSrc(reader.result)
      setEditShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const confirmCrop = async () => {
    const blob = await getCroppedBlob(cropSrc, croppedAreaPixels)
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setImageFile(file)
    setImagePreview(URL.createObjectURL(blob))
    setShowCropper(false)
  }

  const confirmEditCrop = async () => {
    const blob = await getCroppedBlob(editCropSrc, editCroppedAreaPixels)
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setEditImageFile(file)
    setEditImagePreview(URL.createObjectURL(blob))
    setEditShowCropper(false)
  }

  const addChar = async () => {
    if (!name.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let imageUrl = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `avatars/${user.id}/${Date.now()}.${ext}`
      imageUrl = await uploadFile(imageFile, path)
    }
    await supabase.from('characters').insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim(),
      avatar_letter: avatarLetter || name[0],
      color: DEFAULT_CHARACTER_COLOR,
      text_color: DEFAULT_CHARACTER_TEXT_COLOR,
      image_url: imageUrl,
      sort_order: chars.length,
    })
    setName('')
    setDescription('')
    setAvatarLetter('')
    setImageFile(null)
    setImagePreview(null)
    setShowAdd(false)
    setLoading(false)
    fetchChars()
  }

  const startEdit = c => {
    setEditingChar(c.id)
    setEditName(c.name)
    setEditDescription(c.description || '')
    setEditAvatarLetter(c.avatar_letter || '')
    setEditImagePreview(c.image_url || null)
    setEditImageFile(null)
  }

  const saveEdit = async c => {
    if (!editName.trim()) return
    setLoading(true)
    let imageUrl = c.image_url
    if (editImageFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const ext = editImageFile.name.split('.').pop()
      const path = `avatars/${user.id}/${Date.now()}.${ext}`
      imageUrl = await uploadFile(editImageFile, path)
    }
    await supabase
      .from('characters')
      .update({
        name: editName.trim(),
        description: editDescription.trim(),
        avatar_letter: editAvatarLetter || editName[0],
        image_url: imageUrl,
      })
      .eq('id', c.id)
    setEditingChar(null)
    setLoading(false)
    fetchChars()
  }

  const getCroppedBlob = (imageSrc, pixelCrop) =>
    new Promise(resolve => {
      const image = new Image()
      image.src = imageSrc
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = pixelCrop.width
        canvas.height = pixelCrop.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
        canvas.toBlob(resolve, 'image/jpeg')
      }
    })

  const deleteChar = async id => {
    if (!confirm('이 캐릭터를 보관함으로 이동할까요?\n과거 대사는 그대로 보존돼요.')) return
    await supabase.from('characters').update({ is_archived: true }).eq('id', id)
    fetchChars()
  }

  if (!theme)
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
      </div>
    )

  const t = theme
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredChars = chars.filter(character => character.name.toLocaleLowerCase('ko-KR').includes(normalizedSearch))
  const visibleChars = alphabeticalView ? [...filteredChars].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')) : filteredChars

  if (roomId) {
    const selectedCharacters = roomCharacterIds.map(id => chars.find(character => character.id === id)).filter(Boolean)
    const filteredSelectedCharacters = selectedCharacters.filter(character => character.name.toLocaleLowerCase('ko-KR').includes(normalizedSearch))
    const visibleSelectedCharacters = alphabeticalView ? [...filteredSelectedCharacters].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')) : filteredSelectedCharacters
    const availableCharacters = visibleChars.filter(character => !roomCharacterIds.includes(character.id))

    return (
      <>
        <ProfileImageModal profile={profilePreview} onClose={() => setProfilePreview(null)} />
        <div style={{ minHeight: '100vh', background: t.bg, padding: 16 }}>
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, paddingTop: 8 }}>
              <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', marginRight: 8, display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={22} color={t.subText} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: t.theirText, fontWeight: 500 }}>방 캐릭터 설정</div>
                <div style={{ fontSize: 10, color: t.subText, marginTop: 2 }}>{roomName}</div>
              </div>
              <button onClick={saveRoomCharacterPool} disabled={roomPoolSaving} style={{ background: t.point, border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontSize: 12, cursor: 'pointer', opacity: roomPoolSaving ? 0.6 : 1 }}>
                {roomPoolSaving ? '저장 중...' : roomPoolSaved ? '저장됨' : '저장'}
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 18 }}>
              <Search size={15} color={t.subText} style={{ position: 'absolute', left: 11, top: 10 }} />
              <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="캐릭터 이름 검색" style={{ width: '100%', boxSizing: 'border-box', background: t.panel, border: `1px solid ${t.border}`, borderRadius: 10, padding: '9px 12px 9px 34px', color: t.inputText, fontSize: 12, outline: 'none' }} />
            </div>

            <button onClick={() => setAlphabeticalView(current => !current)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '-8px 0 14px auto', background: alphabeticalView ? `${t.point}22` : 'none', border: `1px solid ${alphabeticalView ? t.point : t.border}`, borderRadius: 8, padding: '6px 9px', color: alphabeticalView ? t.point : t.subText, fontSize: 11, cursor: 'pointer' }}>
              <ArrowDownAZ size={14} />
              가나다순 보기
            </button>

            <div style={{ fontSize: 11, color: t.subText, marginBottom: 8 }}>이 방에서 사용할 캐릭터 · {selectedCharacters.length}명</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
              <SortableContext items={visibleSelectedCharacters.map(character => character.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
                  {visibleSelectedCharacters.map(character => {
                    const index = roomCharacterIds.indexOf(character.id)
                    return (
                      <SortableCard key={character.id} id={character.id} disabled={alphabeticalView}>
                        {({ listeners }) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 11, padding: '10px 11px' }}>
                            <button {...listeners} disabled={alphabeticalView} aria-label={`${character.name} 순서 이동`} style={{ display: 'flex', background: 'none', border: 0, padding: 2, cursor: alphabeticalView ? 'default' : 'grab', touchAction: 'none', opacity: alphabeticalView ? 0.25 : 0.65 }}>
                              <GripVertical size={16} color={t.subText} />
                            </button>
                            <button onClick={() => toggleRoomCharacter(character.id)} style={{ width: 24, height: 24, borderRadius: 7, border: 0, background: t.point, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <Check size={15} color="#fff" />
                            </button>
                            <div role="button" tabIndex={0} aria-label={`${character.name} 프로필 사진 크게 보기`} onClick={() => setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name })} style={{ width: 36, height: 36, borderRadius: '50%', background: character.color, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: character.text_color, flexShrink: 0, cursor: 'zoom-in' }}>
                              <img src={character.image_url || DEFAULT_AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ flex: 1, color: t.theirText, fontSize: 13 }}>{character.name}</div>
                            <button disabled={alphabeticalView || index === 0} onClick={() => moveRoomCharacter(character.id, -1)} style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', opacity: alphabeticalView || index === 0 ? 0.25 : 1 }}>
                              <ArrowUp size={16} color={t.subText} />
                            </button>
                            <button disabled={alphabeticalView || index === selectedCharacters.length - 1} onClick={() => moveRoomCharacter(character.id, 1)} style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', opacity: alphabeticalView || index === selectedCharacters.length - 1 ? 0.25 : 1 }}>
                              <ArrowDown size={16} color={t.subText} />
                            </button>
                          </div>
                        )}
                      </SortableCard>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>

            <div style={{ fontSize: 11, color: t.subText, marginBottom: 8 }}>전체 풀에서 추가</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {availableCharacters.map(character => (
                <button key={character.id} onClick={() => toggleRoomCharacter(character.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: t.panel, border: `1px solid ${t.border}`, borderRadius: 11, padding: '10px 11px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, border: `1px solid ${t.border}`, flexShrink: 0 }} />
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${character.name} 프로필 사진 크게 보기`}
                    onClick={event => {
                      event.stopPropagation()
                      setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name })
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name })
                      }
                    }}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: character.color, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: character.text_color, flexShrink: 0, cursor: 'zoom-in' }}>
                    <img src={character.image_url || DEFAULT_AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ color: t.theirText, fontSize: 13 }}>{character.name}</div>
                </button>
              ))}
              {availableCharacters.length === 0 && <div style={{ textAlign: 'center', color: t.subText, fontSize: 12, opacity: 0.55, padding: 20 }}>추가할 캐릭터가 없어요.</div>}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ProfileImageModal profile={profilePreview} onClose={() => setProfilePreview(null)} />
      {/* 크롭 모달 - 새 캐릭터 */}
      {showCropper && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 300, height: 300 }}>
            <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, p) => setCroppedAreaPixels(p)} />
          </div>
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: 200 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={confirmCrop} style={{ background: t.point, border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: 'pointer' }}>
              확인
            </button>
            <button onClick={() => setShowCropper(false)} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 20px', color: t.subText, cursor: 'pointer' }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 크롭 모달 - 편집 */}
      {editShowCropper && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 300, height: 300 }}>
            <Cropper image={editCropSrc} crop={editCrop} zoom={editZoom} aspect={1} cropShape="round" onCropChange={setEditCrop} onZoomChange={setEditZoom} onCropComplete={(_, p) => setEditCroppedAreaPixels(p)} />
          </div>
          <input type="range" min={1} max={3} step={0.1} value={editZoom} onChange={e => setEditZoom(Number(e.target.value))} style={{ width: 200 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={confirmEditCrop} style={{ background: t.point, border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: 'pointer' }}>
              확인
            </button>
            <button onClick={() => setEditShowCropper(false)} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 20px', color: t.subText, cursor: 'pointer' }}>
              취소
            </button>
          </div>
        </div>
      )}
      <div style={{ minHeight: '100vh', background: t.bg, padding: 16 }}>
        <div style={{ maxWidth: 400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', marginRight: 8, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22} color={t.subText} />
            </button>
            <div style={{ fontSize: 16, color: t.theirText, fontWeight: 500, flex: 1 }}>내 캐릭터</div>
            <button
              onClick={() => {
                setShowArchive(!showArchive)
                fetchArchived()
              }}
              style={{
                background: 'none',
                border: `0.5px solid ${t.border}`,
                borderRadius: 8,
                padding: '6px 14px',
                color: t.subText,
                fontSize: 12,
                cursor: 'pointer',
              }}>
              보관함
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                marginLeft: 8,
                background: t.point,
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}>
              + 추가
            </button>
          </div>

          {showAdd && (
            <div style={{ background: t.panel, borderRadius: 14, padding: 16, marginBottom: 14, border: `0.5px solid ${t.border}` }}>
              <div style={{ fontSize: 13, color: t.subText, marginBottom: 10 }}>새 캐릭터</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <label style={{ cursor: 'pointer' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: imagePreview ? 'transparent' : t.bg, border: `0.5px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{imagePreview ? <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, color: t.border }}>+</span>}</div>
                  <div style={{ fontSize: 10, color: t.subText, textAlign: 'center', marginTop: 4 }}>프로필 이미지</div>
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              </div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="캐릭터 이름 *" style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <input value={avatarLetter} onChange={e => setAvatarLetter(e.target.value.slice(0, 2))} placeholder="아바타 글자 (이미지 없을 때 표시)" style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="캐릭터 설명 (선택)" style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', height: 70, marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addChar} disabled={loading} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: 9, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                  {loading ? '...' : '추가'}
                </button>
                <button
                  onClick={() => {
                    setShowAdd(false)
                    setImagePreview(null)
                    setImageFile(null)
                  }}
                  style={{ flex: 1, background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 9, color: t.subText, fontSize: 12, cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </div>
          )}

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={16} color={t.subText} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="캐릭터 이름 검색" aria-label="캐릭터 이름 검색" style={{ width: '100%', boxSizing: 'border-box', background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 10, padding: '10px 36px', color: t.inputText, fontSize: 13, outline: 'none' }} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="검색어 지우기" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', padding: 4, border: 0, background: 'none', cursor: 'pointer' }}>
                <X size={14} color={t.subText} />
              </button>
            )}
          </div>

          <button onClick={() => setAlphabeticalView(current => !current)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 12px auto', background: alphabeticalView ? `${t.point}22` : 'none', border: `1px solid ${alphabeticalView ? t.point : t.border}`, borderRadius: 8, padding: '6px 9px', color: alphabeticalView ? t.point : t.subText, fontSize: 11, cursor: 'pointer' }}>
            <ArrowDownAZ size={14} />
            가나다순 보기
          </button>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGlobalDragEnd}>
            <SortableContext items={visibleChars.map(character => character.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chars.length === 0 && !showAdd && <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 40, opacity: 0.5 }}>캐릭터가 없어요</div>}
                {chars.length > 0 && filteredChars.length === 0 && <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 28, opacity: 0.65 }}>검색 결과가 없습니다.</div>}
                {visibleChars.map(c => (
                  <SortableCard key={c.id} id={c.id} disabled={alphabeticalView}>
                    {({ listeners }) => (
                      <div style={{ background: t.panel, borderRadius: 12, padding: '13px 15px', border: `0.5px solid ${t.border}` }}>
                        {editingChar === c.id ? (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                              <label style={{ cursor: 'pointer' }}>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', background: editImagePreview ? 'transparent' : t.bg, border: `0.5px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{editImagePreview ? <img src={editImagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, color: t.border }}>+</span>}</div>
                                <div style={{ fontSize: 10, color: t.subText, textAlign: 'center', marginTop: 4 }}>프로필 이미지</div>
                                <input type="file" accept="image/*" onChange={handleEditImageChange} style={{ display: 'none' }} />
                              </label>
                            </div>
                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="캐릭터 이름 *" style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                            <input value={editAvatarLetter} onChange={e => setEditAvatarLetter(e.target.value.slice(0, 2))} placeholder="아바타 글자" style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="캐릭터 설명 (선택)" style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', height: 70, marginBottom: 10 }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => saveEdit(c)} disabled={loading} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: 9, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                                {loading ? '...' : '저장'}
                              </button>
                              <button onClick={() => setEditingChar(null)} style={{ flex: 1, background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 9, color: t.subText, fontSize: 12, cursor: 'pointer' }}>
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button {...listeners} disabled={alphabeticalView} aria-label={`${c.name} 순서 이동`} style={{ display: 'flex', background: 'none', border: 0, padding: 1, cursor: alphabeticalView ? 'default' : 'grab', touchAction: 'none', opacity: alphabeticalView ? 0.25 : 0.65 }}>
                              <GripVertical size={17} color={t.subText} />
                            </button>
                            <div role="button" tabIndex={0} aria-label={`${c.name} 프로필 사진 크게 보기`} onClick={() => setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} style={{ width: 44, height: 44, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: c.text_color, flexShrink: 0, overflow: 'hidden', cursor: 'zoom-in' }}>
                              <img src={c.image_url || DEFAULT_AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit(c)}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{c.name}</div>
                              {c.description && <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{c.description}</div>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <button onClick={() => moveGlobalCharacter(c.id, -1)} disabled={alphabeticalView || chars.findIndex(character => character.id === c.id) === 0} aria-label={`${c.name} 위로 이동`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: alphabeticalView || chars.findIndex(character => character.id === c.id) === 0 ? 0.2 : 0.6, display: 'flex', alignItems: 'center' }}>
                                <ArrowUp size={15} color={t.subText} />
                              </button>
                              <button onClick={() => moveGlobalCharacter(c.id, 1)} disabled={alphabeticalView || chars.findIndex(character => character.id === c.id) === chars.length - 1} aria-label={`${c.name} 아래로 이동`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: alphabeticalView || chars.findIndex(character => character.id === c.id) === chars.length - 1 ? 0.2 : 0.6, display: 'flex', alignItems: 'center' }}>
                                <ArrowDown size={15} color={t.subText} />
                              </button>
                            </div>
                            <button onClick={() => deleteChar(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4, display: 'flex', alignItems: 'center' }}>
                              <X size={16} color={t.subText} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </SortableCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {showArchive && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: t.subText, marginBottom: 8 }}>보관된 캐릭터</div>
              {archivedChars.length === 0 && <div style={{ textAlign: 'center', color: t.subText, fontSize: 12, opacity: 0.5 }}>보관된 캐릭터가 없어요</div>}
              {archivedChars.map(c => (
                <div key={c.id} style={{ background: t.bg, borderRadius: 12, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, border: `0.5px solid ${t.border}`, marginBottom: 8, opacity: 0.6 }}>
                  <div role="button" tabIndex={0} aria-label={`${c.name} 프로필 사진 크게 보기`} onClick={() => setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} style={{ width: 40, height: 40, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: c.text_color, flexShrink: 0, overflow: 'hidden', cursor: 'zoom-in' }}>
                    <img src={c.image_url || DEFAULT_AVATAR} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.theirText }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{c.description}</div>}
                  </div>
                  <button onClick={() => restoreChar(c.id)} style={{ background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '5px 8px', color: t.subText, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RotateCcw size={12} color={t.subText} />
                    <span style={{ fontSize: 11 }}>복원</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
