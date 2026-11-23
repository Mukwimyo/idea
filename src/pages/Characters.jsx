import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, uploadFile, validateImageFile } from '../lib/supabase'
import { DEFAULT_THEME_ID, getTheme } from '../lib/themes'
import { useThemeVars } from '../lib/themeVars'
import { ChevronLeft, X, RotateCcw, Search, Check, ArrowDownAZ, GripVertical, Play, Pause, Trash2, Sparkles } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProfileImageModal from '../components/ProfileImageModal'
import { CharacterListSkeleton } from '../components/Skeletons'
import { Button, Card, IconButton, TextArea, TextInput } from '../components/ui'
import { cropProfileImage } from '../lib/profileImageCrop'
import {
  getRoomCharacterPoolErrorMessage,
  replaceRoomCharacterPool,
} from '../features/characters/roomCharacterPoolApi'

const DEFAULT_CHARACTER_COLOR = '#AFA9EC'
const DEFAULT_CHARACTER_TEXT_COLOR = '#26215C'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

function SortableCard({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      className="character-sortable-card"
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : 1, opacity: isDragging ? 0.72 : 1 }}
      {...attributes}>
      {children({ listeners })}
    </div>
  )
}

function SortableFrame({ frame, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: frame.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="character-frame character-sortable-frame"
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 3 : 1, opacity: isDragging ? 0.7 : 1 }}>
      {children}
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
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [archivedChars, setArchivedChars] = useState([])
  const [theme, setTheme] = useState(null)

  const [editingChar, setEditingChar] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)
  const [talkingFrames, setTalkingFrames] = useState([])
  const [talkingFramesLoading, setTalkingFramesLoading] = useState(false)
  const [talkingPreviewPlaying, setTalkingPreviewPlaying] = useState(false)
  const [talkingPreviewIndex, setTalkingPreviewIndex] = useState(0)

  const [showCropper, setShowCropper] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [cropFile, setCropFile] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [cropProgress, setCropProgress] = useState(0)
  const [cropError, setCropError] = useState('')
  const [cropProcessing, setCropProcessing] = useState(false)
  // 편집 중인 캐릭터용도 추가
  const [editShowCropper, setEditShowCropper] = useState(false)
  const [editCropSrc, setEditCropSrc] = useState(null)
  const [editCropFile, setEditCropFile] = useState(null)
  const [editCrop, setEditCrop] = useState({ x: 0, y: 0 })
  const [editZoom, setEditZoom] = useState(1)
  const [editCroppedAreaPixels, setEditCroppedAreaPixels] = useState(null)
  const [editCropProgress, setEditCropProgress] = useState(0)
  const [editCropError, setEditCropError] = useState('')
  const [editCropProcessing, setEditCropProcessing] = useState(false)

  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }))

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!talkingPreviewPlaying || talkingFrames.length === 0) return undefined
    let timer
    let current = 0
    const scheduleNextFrame = () => {
      const total = talkingFrames.length + 1
      let next = current
      while (next === current) next = Math.floor(Math.random() * total)
      current = next
      setTalkingPreviewIndex(next)
      const delay = next === 0 ? 260 + Math.random() * 180 : 130 + Math.random() * 120
      timer = window.setTimeout(scheduleNextFrame, delay)
    }
    timer = window.setTimeout(scheduleNextFrame, 160)
    return () => window.clearTimeout(timer)
  }, [talkingPreviewPlaying, talkingFrames.length])

  const init = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
    const resolvedTheme = getTheme(data?.theme_id || DEFAULT_THEME_ID)
    localStorage.setItem('idea-theme-id', data?.theme_id || DEFAULT_THEME_ID)
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
    const results = await Promise.all(
      orderedCharacters.map((character, index) =>
        supabase.from('characters').update({ sort_order: index }).eq('id', character.id).eq('user_id', userId)
      )
    )
    if (results.some(result => result.error)) {
      alert('캐릭터 순서를 저장하지 못했어요.')
      fetchChars(userId)
    }
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
    try {
      await replaceRoomCharacterPool(supabase, roomId, roomCharacterIds)
      setRoomPoolSaved(true)
    } catch (error) {
      console.error('방 캐릭터 목록 저장 실패', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      })
      alert(getRoomCharacterPoolErrorMessage(error))
      await fetchChars(userId)
    } finally {
      setRoomPoolSaving(false)
    }
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
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) {
      alert(validationError)
      e.target.value = ''
      return
    }
    setCropFile(file)
    setCropError('')
    setCropProgress(0)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleEditImageChange = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) {
      alert(validationError)
      e.target.value = ''
      return
    }
    setEditCropFile(file)
    setEditCropError('')
    setEditCropProgress(0)
    setEditCrop({ x: 0, y: 0 })
    setEditZoom(1)
    setEditCroppedAreaPixels(null)
    const reader = new FileReader()
    reader.onload = () => {
      setEditCropSrc(reader.result)
      setEditShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const confirmCrop = async () => {
    if (!cropFile || !cropSrc || !croppedAreaPixels) return
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

  const confirmEditCrop = async () => {
    if (!editCropFile || !editCropSrc || !editCroppedAreaPixels) return
    setEditCropProcessing(true)
    setEditCropError('')
    try {
      const file = await cropProfileImage(editCropFile, editCropSrc, editCroppedAreaPixels, setEditCropProgress)
      const validationError = validateImageFile(file)
      if (validationError) throw new Error(validationError)
      setEditImageFile(file)
      setEditImagePreview(URL.createObjectURL(file))
      setEditCropFile(null)
      setEditShowCropper(false)
    } catch (error) {
      console.error('character edit image crop failed:', error)
      setEditCropError(error?.message || '이미지를 자르지 못했어요. 다른 이미지를 선택해 주세요.')
    } finally {
      setEditCropProcessing(false)
    }
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
      color: DEFAULT_CHARACTER_COLOR,
      text_color: DEFAULT_CHARACTER_TEXT_COLOR,
      image_url: imageUrl,
      sort_order: chars.length,
    })
    setName('')
    setDescription('')
    setImageFile(null)
    setImagePreview(null)
    setShowAdd(false)
    setLoading(false)
    fetchChars()
  }

  const fetchTalkingFrames = async characterId => {
    const { data, error } = await supabase
      .from('character_talking_frames')
      .select('*')
      .eq('character_id', characterId)
      .order('sort_order')
      .order('created_at')
    if (!error) setTalkingFrames(data || [])
  }

  const uploadTalkingFrames = async (character, files) => {
    const selected = Array.from(files || []).slice(0, Math.max(0, 4 - talkingFrames.length))
    if (selected.length === 0) return
    for (const file of selected) {
      const validationError = validateImageFile(file)
      if (validationError) {
        alert(validationError)
        return
      }
    }
    setTalkingFramesLoading(true)
    const rows = []
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index]
      const ext = file.name.split('.').pop()
      const path = `talking-frames/${userId}/${character.id}/${Date.now()}-${index}.${ext}`
      const imageUrl = await uploadFile(file, path)
      rows.push({
        character_id: character.id,
        user_id: userId,
        image_url: imageUrl,
        sort_order: talkingFrames.length + index,
      })
    }
    const { error } = await supabase.from('character_talking_frames').insert(rows)
    setTalkingFramesLoading(false)
    if (error) {
      alert('말하기 프레임을 저장하지 못했어요. Supabase 마이그레이션 적용 여부를 확인해 주세요.')
      return
    }
    fetchTalkingFrames(character.id)
  }

  const deleteTalkingFrame = async frame => {
    const { error } = await supabase.from('character_talking_frames').delete().eq('id', frame.id).eq('user_id', userId)
    if (error) {
      alert('말하기 프레임을 삭제하지 못했어요.')
      return
    }
    setTalkingFrames(current => current.filter(item => item.id !== frame.id))
    setTalkingPreviewIndex(0)
  }

  const reorderTalkingFrames = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = talkingFrames.findIndex(frame => frame.id === active.id)
    const newIndex = talkingFrames.findIndex(frame => frame.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(talkingFrames, oldIndex, newIndex)
    setTalkingFrames(reordered)
    const results = await Promise.all(
      reordered.map((frame, index) => supabase.from('character_talking_frames').update({ sort_order: index }).eq('id', frame.id).eq('user_id', userId))
    )
    if (results.some(result => result.error)) {
      alert('말하기 프레임 순서를 저장하지 못했어요.')
      fetchTalkingFrames(editingChar)
    }
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
        image_url: imageUrl,
      })
      .eq('id', c.id)
    setEditingChar(null)
    setLoading(false)
    fetchChars()
  }

  const deleteChar = async id => {
    if (!confirm('이 캐릭터를 보관함으로 이동할까요?\n과거 대사는 그대로 보존돼요.')) return
    await supabase.from('characters').update({ is_archived: true }).eq('id', id)
    fetchChars()
  }

  useThemeVars(theme)

  if (!theme)
    return <CharacterListSkeleton room={Boolean(roomId)} />

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
      <div className="characters-page">
        <div className="character-shell">
          <div className="character-header character-header--room">
            <IconButton label="뒤로" onClick={() => navigate(-1)} className="character-back">
              <ChevronLeft size={22} />
            </IconButton>
            <div className="character-grow">
              <div className="character-title">방 캐릭터 설정</div>
              <div className="character-room-name">{roomName}</div>
            </div>
            <Button size="sm" onClick={saveRoomCharacterPool} disabled={roomPoolSaving}>
              {roomPoolSaving ? '저장 중...' : roomPoolSaved ? '저장됨' : '저장'}
            </Button>
          </div>

          <div className="character-search character-search--room">
            <Search size={15} className="character-search-icon" aria-hidden="true" />
            <TextInput value={searchQuery} onChange={event => setSearchQuery(event.target.value)} aria-label="캐릭터 이름 검색" placeholder="캐릭터 이름 검색" className="character-search-input" />
          </div>

          <Button variant="secondary" size="sm"
            onClick={() => setAlphabeticalView(current => !current)}
            className={`character-sort${alphabeticalView ? ' is-active' : ''}`}>
            <ArrowDownAZ size={14} />
            가나다순 보기
          </Button>

          <div className="character-section-label">이 방에서 사용할 캐릭터 · {selectedCharacters.length}명</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
            <SortableContext items={visibleSelectedCharacters.map(character => character.id)} strategy={verticalListSortingStrategy}>
              <div className="character-list character-list--selected">
                {visibleSelectedCharacters.map(character => {
                return (
                <SortableCard key={character.id} id={character.id} disabled={alphabeticalView}>
                  {({ listeners }) => <Card className="character-list-item character-row character-row--room">
                  <IconButton {...listeners} disabled={alphabeticalView} label={`${character.name} 순서 이동`} className="character-drag">
                    <GripVertical size={16} />
                  </IconButton>
                  <IconButton label={`${character.name} 방 캐릭터에서 제외`} onClick={() => toggleRoomCharacter(character.id)} className="character-selected-check">
                    <Check size={15} />
                  </IconButton>
                  <div role="button" tabIndex={0} aria-label={`${character.name} 프로필 사진 크게 보기`} onClick={() => setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name })} className="character-avatar character-avatar--room" style={{ background: character.color, color: character.text_color }}>
                    <img src={character.image_url || DEFAULT_AVATAR} alt="" className="squircle-media character-media" />
                  </div>
                  <div className="character-name character-grow">{character.name}</div>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/characters/${character.id}/text-effects`)} aria-label={`${character.name} 대사 연출 설정`} className="character-effects">
                    <Sparkles size={13} className="character-accent-icon" /> 연출
                  </Button>
                  </Card>}
                </SortableCard>
                )
              })}
              </div>
            </SortableContext>
          </DndContext>

          <div className="character-section-label">전체 풀에서 추가</div>
          <div className="character-list">
            {availableCharacters.map(character => (
              <Button variant="ghost" key={character.id} onClick={() => toggleRoomCharacter(character.id)} className="character-list-item character-row character-row--room character-available">
                <div className="character-empty-check" />
                <div role="button" tabIndex={0} aria-label={`${character.name} 프로필 사진 크게 보기`} onClick={event => { event.stopPropagation(); setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name }) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setProfilePreview({ url: character.image_url || DEFAULT_AVATAR, name: character.name }) } }} className="character-avatar character-avatar--room" style={{ background: character.color, color: character.text_color }}>
                  <img src={character.image_url || DEFAULT_AVATAR} alt="" className="squircle-media character-media" />
                </div>
                <div className="character-name">{character.name}</div>
              </Button>
            ))}
            {availableCharacters.length === 0 && <div className="character-empty character-empty--available">추가할 캐릭터가 없어요.</div>}
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
        <div className="character-crop-backdrop character-crop-backdrop--list">
          <div className="character-crop-panel">
            <div className="character-crop-media character-crop-media--list">
              <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="rect" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, p) => setCroppedAreaPixels(p)} />
            </div>
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="character-crop-range character-crop-range--list" />
            {cropFile?.type === 'image/gif' && <div className="character-crop-copy">선택 영역을 원본 해상도로 자르고 GIF 움직임을 유지해요. 잘라낸 파일도 5MB 이하여야 해요.</div>}
            {cropError && <div role="alert" className="character-crop-error">{cropError}</div>}
            <div className="character-actions">
              <Button onClick={confirmCrop} disabled={cropProcessing} className="character-crop-confirm">
                {cropProcessing ? `${cropFile?.type === 'image/gif' ? 'GIF' : '사진'} 처리 중 ${cropProgress}%` : '확인'}
              </Button>
              <Button variant="secondary" onClick={() => { if (!cropProcessing) { setShowCropper(false); setCropFile(null); setCropError('') } }} disabled={cropProcessing}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 크롭 모달 - 편집 */}
      {editShowCropper && (
        <div className="character-crop-backdrop character-crop-backdrop--list">
          <div className="character-crop-panel">
            <div className="character-crop-media character-crop-media--list">
              <Cropper image={editCropSrc} crop={editCrop} zoom={editZoom} aspect={1} cropShape="rect" onCropChange={setEditCrop} onZoomChange={setEditZoom} onCropComplete={(_, p) => setEditCroppedAreaPixels(p)} />
            </div>
            <input type="range" min={1} max={3} step={0.1} value={editZoom} onChange={e => setEditZoom(Number(e.target.value))} className="character-crop-range character-crop-range--list" />
            {editCropFile?.type === 'image/gif' && <div className="character-crop-copy">선택 영역을 원본 해상도로 자르고 GIF 움직임을 유지해요. 잘라낸 파일도 5MB 이하여야 해요.</div>}
            {editCropError && <div role="alert" className="character-crop-error">{editCropError}</div>}
            <div className="character-actions">
              <Button onClick={confirmEditCrop} disabled={editCropProcessing} className="character-crop-confirm">
                {editCropProcessing ? `${editCropFile?.type === 'image/gif' ? 'GIF' : '사진'} 처리 중 ${editCropProgress}%` : '확인'}
              </Button>
              <Button variant="secondary" onClick={() => { if (!editCropProcessing) { setEditShowCropper(false); setEditCropFile(null); setEditCropError('') } }} disabled={editCropProcessing}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="characters-page">
        <div className="character-shell">
          <div className="character-header">
            <IconButton label="뒤로" onClick={() => navigate(-1)} className="character-back">
              <ChevronLeft size={22} />
            </IconButton>
            <div className="character-title character-grow">내 캐릭터</div>
            <Button variant="secondary" size="sm"
              onClick={() => {
                setShowArchive(!showArchive)
                fetchArchived()
              }}>
              보관함
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              + 추가
            </Button>
          </div>

          {showAdd && (
            <Card className="character-editor-panel">
              <div className="character-editor-label">새 캐릭터</div>
              <div className="character-photo-field">
                <label className="character-photo-label">
                  <div className="squircle-media character-photo-placeholder">{imagePreview ? <img src={imagePreview} className="character-media" /> : <span className="character-photo-plus">+</span>}</div>
                  <div className="character-photo-caption">프로필 이미지</div>
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
              <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="캐릭터 이름 *" className="character-form-input" />
              <TextArea value={description} onChange={e => setDescription(e.target.value)} placeholder="캐릭터 설명 (선택)" className="character-form-description" />
              <div className="character-actions">
                <Button onClick={addChar} disabled={loading} className="character-action-fill">
                  {loading ? '...' : '추가'}
                </Button>
                <Button variant="secondary"
                  onClick={() => {
                    setShowAdd(false)
                    setImagePreview(null)
                    setImageFile(null)
                    setCropFile(null)
                  }}
                  className="character-action-fill">
                  취소
                </Button>
              </div>
            </Card>
          )}

          <div className="character-search">
            <Search size={16} className="character-search-icon" aria-hidden="true" />
            <TextInput
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="캐릭터 이름 검색"
              aria-label="캐릭터 이름 검색"
              className="character-search-input character-search-input--clearable" />
            {searchQuery && (
              <IconButton onClick={() => setSearchQuery('')} label="검색어 지우기" className="character-search-clear">
                <X size={14} />
              </IconButton>
            )}
          </div>

          <Button variant="secondary" size="sm"
            onClick={() => setAlphabeticalView(current => !current)}
            className={`character-sort${alphabeticalView ? ' is-active' : ''}`}>
            <ArrowDownAZ size={14} />
            가나다순 보기
          </Button>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGlobalDragEnd}>
            <SortableContext items={visibleChars.map(character => character.id)} strategy={verticalListSortingStrategy}>
              <div className="character-list">
                {chars.length === 0 && !showAdd && <div className="character-empty character-empty--initial">캐릭터가 없어요</div>}
                {chars.length > 0 && filteredChars.length === 0 && <div className="character-empty character-empty--search">검색 결과가 없습니다.</div>}
                {visibleChars.map(c => (
              <SortableCard key={c.id} id={c.id} disabled={alphabeticalView}>
                {({ listeners }) => <Card className="character-list-item">
                {editingChar === c.id ? (
                  <div className="character-expand">
                    <div className="character-photo-field">
                      <label className="character-photo-label">
                        <div className="squircle-media character-photo-placeholder">{editImagePreview ? <img src={editImagePreview} className="character-media" /> : <span className="character-photo-plus">+</span>}</div>
                        <div className="character-photo-caption">프로필 이미지</div>
                        <input type="file" accept="image/*" onChange={handleEditImageChange} />
                      </label>
                    </div>
                    <TextInput value={editName} onChange={e => setEditName(e.target.value)} placeholder="캐릭터 이름 *" className="character-form-input" />
                    <TextArea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="캐릭터 설명 (선택)" className="character-form-description" />
                    <Card className="character-frames-panel">
                      <div className="character-frames-heading">
                        <div className="character-grow">
                          <div className="character-frames-title">입력 중 말하기 애니메이션</div>
                          <div className="character-frames-copy">입 모양이 다른 이미지를 2~4장 등록해 주세요.</div>
                        </div>
                        <IconButton type="button" onClick={() => { setTalkingPreviewPlaying(current => !current); setTalkingPreviewIndex(0) }} disabled={talkingFrames.length === 0} label={talkingPreviewPlaying ? '미리보기 정지' : '미리보기 재생'} className="character-frames-play">
                          {talkingPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                        </IconButton>
                      </div>
                      <div className="character-frames-preview">
                        <div className="squircle-media character-frames-avatar">
                          <img src={talkingPreviewIndex === 0 ? editImagePreview || DEFAULT_AVATAR : talkingFrames[talkingPreviewIndex - 1]?.image_url || editImagePreview || DEFAULT_AVATAR} alt="말하기 애니메이션 미리보기" className="character-media" />
                        </div>
                        <div className="character-frames-copy">기본 프로필과 등록된 프레임을 번갈아 재생합니다. 얼굴 위치와 이미지 크기를 동일하게 맞추면 자연스러워요.</div>
                      </div>
                      <div className="character-frames-grid">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderTalkingFrames}>
                          <SortableContext items={talkingFrames.map(frame => frame.id)} strategy={rectSortingStrategy}>
                            {talkingFrames.map((frame, index) => (
                              <SortableFrame key={frame.id} frame={frame}>
                                <div className="character-frame-media character-frame-media--drag">
                                  <img src={frame.image_url} alt={`말하기 프레임 ${index + 1}`} draggable={false} className="character-media character-media--drag" />
                                  <IconButton type="button" onPointerDown={event => event.stopPropagation()} onClick={() => deleteTalkingFrame(frame)} label={`말하기 프레임 ${index + 1} 삭제`} className="character-frame-delete"><Trash2 size={11} /></IconButton>
                                </div>
                              </SortableFrame>
                            ))}
                          </SortableContext>
                        </DndContext>
                        {talkingFrames.length < 4 && (
                          <label className="character-frame-add">
                            <span className="character-frame-plus">+</span>
                            <input type="file" accept="image/*" multiple disabled={talkingFramesLoading} onChange={event => { uploadTalkingFrames(c, event.target.files); event.target.value = '' }} />
                          </label>
                        )}
                      </div>
                    </Card>
                    <div className="character-actions">
                      <Button onClick={() => saveEdit(c)} disabled={loading} className="character-action-fill">
                        {loading ? '...' : '저장'}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingChar(null)} className="character-action-fill">
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="character-row">
                    <IconButton {...listeners} disabled={alphabeticalView} label={`${c.name} 순서 이동`} className="character-drag">
                      <GripVertical size={17} />
                    </IconButton>
                    <div role="button" tabIndex={0} aria-label={`${c.name} 프로필 사진 크게 보기`} onClick={() => setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} className="squircle-media character-avatar character-avatar--active" style={{ background: c.color, color: c.text_color }}><img src={c.image_url || DEFAULT_AVATAR} alt="" className="character-media" /></div>
                    <div className="character-edit-link" onClick={() => navigate(`/characters/${c.id}/edit`)}>
                      <div className="character-name">{c.name}</div>
                      {c.description && <div className="character-description">{c.description}</div>}
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/characters/${c.id}/text-effects`)} aria-label={`${c.name} 대사 연출 설정`} className="character-effects">
                      <Sparkles size={13} className="character-accent-icon" /> 연출
                    </Button>
                    <IconButton label={`${c.name} 삭제`} onClick={() => deleteChar(c.id)} className="character-delete">
                      <X size={16} />
                    </IconButton>
                  </div>
                )}
                </Card>}
              </SortableCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {showArchive && (
            <div className="character-archive">
              <div className="character-section-label">보관된 캐릭터</div>
              {archivedChars.length === 0 && <div className="character-empty character-empty--archive">보관된 캐릭터가 없어요</div>}
              {archivedChars.map(c => (
                <Card key={c.id} className="character-list-item character-row character-archived">
                  <div role="button" tabIndex={0} aria-label={`${c.name} 프로필 사진 크게 보기`} onClick={() => setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setProfilePreview({ url: c.image_url || DEFAULT_AVATAR, name: c.name })} className="squircle-media character-avatar character-avatar--archived" style={{ background: c.color, color: c.text_color }}><img src={c.image_url || DEFAULT_AVATAR} alt="" className="character-media" /></div>
                  <div className="character-grow">
                    <div className="character-name character-name--archived">{c.name}</div>
                    {c.description && <div className="character-description">{c.description}</div>}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => restoreChar(c.id)} className="character-restore">
                    <RotateCcw size={12} />
                    복원
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
