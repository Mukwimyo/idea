import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, uploadFile } from '../lib/supabase'
import { getTheme } from '../lib/themes'
import { ChevronLeft, X, RotateCcw } from 'lucide-react'

const COLORS = [
    { bg: '#AFA9EC', text: '#26215C' },
    { bg: '#9FE1CB', text: '#085041' },
    { bg: '#F4C0D1', text: '#72243E' },
    { bg: '#FAC775', text: '#412402' },
    { bg: '#A8D8EA', text: '#0a3d55' },
    { bg: '#C8E6C9', text: '#1b5e20' },
]

export default function Characters() {
    const [chars, setChars] = useState([])
    const [showAdd, setShowAdd] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [avatarLetter, setAvatarLetter] = useState('')
    const [selectedColor, setSelectedColor] = useState(0)
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showArchive, setShowArchive] = useState(false)
    const [archivedChars, setArchivedChars] = useState([])
    const [theme, setTheme] = useState(null)
    const navigate = useNavigate()

    useEffect(() => { init() }, [])

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).single()
        setTheme(getTheme(data?.theme_id || 'dark-purple'))
        fetchChars(user.id)
    }

    const fetchChars = async (uid) => {
        const { data: { user } } = uid ? { data: { user: { id: uid } } } : await supabase.auth.getUser()
        const { data } = await supabase.from('characters')
            .select().eq('user_id', user.id).eq('is_archived', false)
        if (data) setChars(data)
    }

    const fetchArchived = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase.from('characters')
            .select().eq('user_id', user.id).eq('is_archived', true)
        if (data) setArchivedChars(data)
    }

    const restoreChar = async (id) => {
        await supabase.from('characters').update({ is_archived: false }).eq('id', id)
        fetchChars(); fetchArchived()
    }

    const handleImageChange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
    }

    const addChar = async () => {
        if (!name.trim()) return
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        const color = COLORS[selectedColor]
        let imageUrl = null
        if (imageFile) {
            const ext = imageFile.name.split('.').pop()
            const path = `avatars/${user.id}/${Date.now()}.${ext}`
            imageUrl = await uploadFile(imageFile, path)
        }
        await supabase.from('characters').insert({
            user_id: user.id, name: name.trim(), description: description.trim(),
            avatar_letter: avatarLetter || name[0], color: color.bg, text_color: color.text, image_url: imageUrl
        })
        setName(''); setDescription(''); setAvatarLetter('')
        setImageFile(null); setImagePreview(null)
        setShowAdd(false); setLoading(false)
        fetchChars()
    }

    const deleteChar = async (id) => {
        if (!confirm('이 캐릭터를 보관함으로 이동할까요?\n과거 대사는 그대로 보존돼요.')) return
        await supabase.from('characters').update({ is_archived: true }).eq('id', id)
        fetchChars()
    }

    if (!theme) return (
        <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#7F77DD', fontSize: 28 }}>✦</div>
        </div>
    )

    const t = theme

    return (
        <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'sans-serif', padding: 16 }}>
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', marginRight: 8, display: 'flex', alignItems: 'center' }}>
                        <ChevronLeft size={22} color={t.subText} />
                    </button>
                    <div style={{ fontSize: 16, color: t.theirText, fontWeight: 500, flex: 1 }}>내 캐릭터</div>
                    <button onClick={() => { setShowArchive(!showArchive); fetchArchived() }} style={{
                        background: 'none', border: `0.5px solid ${t.border}`,
                        borderRadius: 8, padding: '6px 14px', color: t.subText, fontSize: 12, cursor: 'pointer'
                    }}>보관함</button>
                    <button onClick={() => setShowAdd(true)} style={{
                        marginLeft: 8, background: t.point, border: 'none', borderRadius: 8,
                        padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer'
                    }}>+ 추가</button>
                </div>

                {showAdd && (
                    <div style={{ background: t.panel, borderRadius: 14, padding: 16, marginBottom: 14, border: `0.5px solid ${t.border}` }}>
                        <div style={{ fontSize: 13, color: t.subText, marginBottom: 10 }}>새 캐릭터</div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            <label style={{ cursor: 'pointer' }}>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', background: imagePreview ? 'transparent' : t.bg, border: `0.5px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {imagePreview ? <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, color: t.border }}>+</span>}
                                </div>
                                <div style={{ fontSize: 10, color: t.subText, textAlign: 'center', marginTop: 4 }}>프로필 이미지</div>
                                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                            </label>
                        </div>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="캐릭터 이름 *"
                            style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                        <input value={avatarLetter} onChange={e => setAvatarLetter(e.target.value.slice(0, 2))} placeholder="아바타 글자 (이미지 없을 때 표시)"
                            style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="캐릭터 설명 (선택)"
                            style={{ width: '100%', background: t.bg, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.inputText, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', height: 70, fontFamily: 'sans-serif', marginBottom: 10 }} />
                        <div style={{ fontSize: 11, color: t.subText, marginBottom: 7 }}>말풍선 색상</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                            {COLORS.map((c, i) => (
                                <div key={i} onClick={() => setSelectedColor(i)} style={{ width: 28, height: 28, borderRadius: '50%', background: c.bg, cursor: 'pointer', border: selectedColor === i ? '2.5px solid #fff' : '2px solid transparent' }} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={addChar} disabled={loading} style={{ flex: 1, background: t.point, border: 'none', borderRadius: 8, padding: 9, color: '#fff', fontSize: 12, cursor: 'pointer' }}>{loading ? '...' : '추가'}</button>
                            <button onClick={() => { setShowAdd(false); setImagePreview(null); setImageFile(null) }} style={{ flex: 1, background: 'none', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 9, color: t.subText, fontSize: 12, cursor: 'pointer' }}>취소</button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {chars.length === 0 && !showAdd && (
                        <div style={{ textAlign: 'center', color: t.subText, fontSize: 13, marginTop: 40, opacity: 0.5 }}>캐릭터가 없어요</div>
                    )}
                    {chars.map(c => (
                        <div key={c.id} style={{ background: t.panel, borderRadius: 12, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, border: `0.5px solid ${t.border}` }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: c.text_color, flexShrink: 0, overflow: 'hidden' }}>
                                {c.image_url ? <img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.avatar_letter}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: t.theirText }}>{c.name}</div>
                                {c.description && <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{c.description}</div>}
                            </div>
                            <button onClick={() => deleteChar(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4, display: 'flex', alignItems: 'center' }}>
                                <X size={16} color={t.subText} />
                            </button>
                        </div>
                    ))}
                </div>

                {showArchive && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, color: t.subText, marginBottom: 8 }}>보관된 캐릭터</div>
                        {archivedChars.length === 0 && (
                            <div style={{ textAlign: 'center', color: t.subText, fontSize: 12, opacity: 0.5 }}>보관된 캐릭터가 없어요</div>
                        )}
                        {archivedChars.map(c => (
                            <div key={c.id} style={{ background: t.bg, borderRadius: 12, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, border: `0.5px solid ${t.border}`, marginBottom: 8, opacity: 0.6 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: c.text_color, flexShrink: 0, overflow: 'hidden' }}>
                                    {c.image_url ? <img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.avatar_letter}
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
    )
}