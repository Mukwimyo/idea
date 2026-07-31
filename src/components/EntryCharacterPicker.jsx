const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

export default function EntryCharacterPicker({ open, roomName, characters, theme, loading, onSelect, onClose }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 420, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 14, background: 'rgba(0,0,0,0.52)' }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 452, maxHeight: '72dvh', overflowY: 'auto', padding: 14, borderRadius: 18, border: `1px solid ${theme.border}`, background: theme.panel, boxShadow: '0 18px 48px rgba(0,0,0,0.34)', animation: 'ui-slide-up 220ms cubic-bezier(0.2,0.8,0.2,1)' }}>
        <div style={{ marginBottom: 4, color: theme.theirText, fontSize: 15, fontWeight: 600 }}>{roomName}</div>
        <div style={{ marginBottom: 13, color: theme.subText, fontSize: 11 }}>어떤 프로필로 들어갈지 선택해 주세요.</div>
        <div style={{ display: 'grid', gap: 7 }}>
          {characters.map(character => (
            <button key={character.id} disabled={loading} onClick={() => onSelect(character)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.theirText, textAlign: 'left', opacity: loading ? 0.55 : 1 }}>
              <img src={character.image_url || DEFAULT_AVATAR} alt="" style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, objectFit: 'cover' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{character.name}</div>
                {character.description && <div style={{ marginTop: 2, color: theme.subText, fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{character.description}</div>}
              </div>
            </button>
          ))}
        </div>
        {characters.length === 0 && <div style={{ padding: '24px 10px', color: theme.subText, fontSize: 12, textAlign: 'center' }}>먼저 사용할 캐릭터를 만들어 주세요.</div>}
        <button onClick={onClose} disabled={loading} style={{ width: '100%', marginTop: 10, padding: 9, borderRadius: 10, border: `1px solid ${theme.border}`, background: 'none', color: theme.subText }}>취소</button>
      </div>
    </div>
  )
}
