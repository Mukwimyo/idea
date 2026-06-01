import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, uploadFile } from '../lib/supabase'

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
    const navigate = useNavigate()

    useEffect(() => { fetchChars() }, [])

    const fetchChars = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase.from('characters')
            .select()
            .eq('user_id', user.id)
            .eq('is_archived', false)
        if (data) setChars(data)
    }

    const fetchArchived = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase.from('characters')
            .select()
            .eq('user_id', user.id)
            .eq('is_archived', true)
        if (data) setArchivedChars(data)
    }

    const restoreChar = async (id) => {
        await supabase.from('characters').update({ is_archived: false }).eq('id', id)
        fetchChars()
        fetchArchived()
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
            user_id: user.id,
            name: name.trim(),
            description: description.trim(),
            avatar_letter: avatarLetter || name[0],
            color: color.bg,
            text_color: color.text,
            image_url: imageUrl
        })
        setName(''); setDescription(''); setAvatarLetter('')
        setImageFile(null); setImagePreview(null)
        setShowAdd(false)
        setLoading(false)
        fetchChars()
    }

    const deleteChar = async (id) => {
        if (!confirm('이 캐릭터를 보관함으로 이동할까요?\n과거 대사는 그대로 보존돼요.')) return
        await supabase.from('characters').update({ is_archived: true }).eq('id', id)
        fetchChars()
    }
    return (
        <div style={{ minHeight: '100vh', background: '#1a1a2e', fontFamily: 'sans-serif', padding: 16 }}>
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
                    <button onClick={() => navigate(-1)} style={{
                        background: 'none', border: 'none', color: '#8b84c4', fontSize: 20, cursor: 'pointer', padding: 0, marginRight: 8
                    }}>‹</button>
                    <div style={{ fontSize: 16, color: '#fff', fontWeight: 500 }}>내 캐릭터</div>
                    <button onClick={() => { setShowArchive(!showArchive); fetchArchived() }} style={{
                        background: 'none', border: '0.5px solid #3d3580',
                        borderRadius: 8, padding: '6px 14px', color: '#8b84c4', fontSize: 12, cursor: 'pointer'
                    }}>보관함</button>
                    <button onClick={() => setShowAdd(true)} style={{
                        marginLeft: 8, background: '#7F77DD', border: 'none', borderRadius: 8,
                        padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer'
                    }}>+ 추가</button>
                </div>

                {showAdd && (
                    <div style={{ background: '#2d2157', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                        <div style={{ fontSize: 13, color: '#c9b8e8', marginBottom: 10 }}>새 캐릭터</div>

                        {/* 이미지 업로드 */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            <label style={{ cursor: 'pointer' }}>
                                <div style={{
                                    width: 72, height: 72, borderRadius: '50%',
                                    background: imagePreview ? 'transparent' : '#1a1a2e',
                                    border: '0.5px dashed #3d3580',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', position: 'relative'
                                }}>
                                    {imagePreview
                                        ? <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <span style={{ fontSize: 24, color: '#3d3580' }}>+</span>
                                    }
                                </div>
                                <div style={{ fontSize: 10, color: '#8b84c4', textAlign: 'center', marginTop: 4 }}>프로필 이미지</div>
                                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                            </label>
                        </div>

                        <input value={name} onChange={e => setName(e.target.value)} placeholder="캐릭터 이름 *"
                            style={{ width: '100%', background: '#1a1a2e', border: '0.5px solid #3d3580', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                        <input value={avatarLetter} onChange={e => setAvatarLetter(e.target.value.slice(0, 2))} placeholder="아바타 글자 (이미지 없을 때 표시)"
                            style={{ width: '100%', background: '#1a1a2e', border: '0.5px solid #3d3580', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="캐릭터 설명 (선택)"
                            style={{ width: '100%', background: '#1a1a2e', border: '0.5px solid #3d3580', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', height: 70, fontFamily: 'sans-serif', marginBottom: 10 }} />
                        <div style={{ fontSize: 11, color: '#8b84c4', marginBottom: 7 }}>말풍선 색상</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                            {COLORS.map((c, i) => (
                                <div key={i} onClick={() => setSelectedColor(i)} style={{
                                    width: 28, height: 28, borderRadius: '50%', background: c.bg, cursor: 'pointer',
                                    border: selectedColor === i ? '2.5px solid #fff' : '2px solid transparent'
                                }} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={addChar} disabled={loading} style={{ flex: 1, background: '#7F77DD', border: 'none', borderRadius: 8, padding: 9, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                                {loading ? '...' : '추가'}
                            </button>
                            <button onClick={() => { setShowAdd(false); setImagePreview(null); setImageFile(null) }} style={{ flex: 1, background: 'none', border: '0.5px solid #3d3580', borderRadius: 8, padding: 9, color: '#8b84c4', fontSize: 12, cursor: 'pointer' }}>취소</button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {chars.length === 0 && !showAdd && (
                        <div style={{ textAlign: 'center', color: '#3d3580', fontSize: 13, marginTop: 40 }}>캐릭터가 없어요</div>
                    )}
                    {chars.map(c => (
                        <div key={c.id} style={{ background: '#2d2157', borderRadius: 12, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #3d3580' }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: '50%', background: c.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 15, fontWeight: 500, color: c.text_color, flexShrink: 0,
                                overflow: 'hidden'
                            }}>
                                {c.image_url
                                    ? <img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : c.avatar_letter
                                }
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{c.name}</div>
                                {c.description && <div style={{ fontSize: 11, color: '#8b84c4', marginTop: 2 }}>{c.description}</div>}
                            </div>
                            <button onClick={() => deleteChar(c.id)} style={{ background: 'none', border: 'none', color: '#3d3580', fontSize: 16, cursor: 'pointer', padding: 4 }}>×</button>
                        </div>
                    ))}
                </div>
                {showArchive && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, color: '#8b84c4', marginBottom: 8 }}>보관된 캐릭터</div>
                        {archivedChars.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#3d3580', fontSize: 12 }}>보관된 캐릭터가 없어요</div>
                        )}
                        {archivedChars.map(c => (
                            <div key={c.id} style={{ background: '#1a1a2e', borderRadius: 12, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid #3d3580', marginBottom: 8, opacity: 0.6 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: c.text_color, flexShrink: 0, overflow: 'hidden' }}>
                                    {c.image_url
                                        ? <img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : c.avatar_letter
                                    }
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{c.name}</div>
                                    {c.description && <div style={{ fontSize: 11, color: '#8b84c4', marginTop: 2 }}>{c.description}</div>}
                                </div>
                                <button onClick={() => restoreChar(c.id)} style={{ background: 'none', border: '0.5px solid #3d3580', borderRadius: 8, padding: '4px 10px', color: '#8b84c4', fontSize: 11, cursor: 'pointer' }}>복원</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}