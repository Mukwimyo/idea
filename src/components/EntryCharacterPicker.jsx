import { Button, Card } from './ui'

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}default-avatar.png`

export default function EntryCharacterPicker({ open, roomName, characters, loading, onSelect, onClose }) {
  if (!open) return null
  return (
    <div onClick={onClose} className="room-sheet-backdrop entry-character-backdrop">
      <Card onClick={event => event.stopPropagation()} className="room-sheet entry-character-picker">
        <div className="room-panel-title">{roomName}</div>
        <div className="entry-character-picker__description">어떤 프로필로 들어갈지 선택해 주세요.</div>
        <div className="room-panel-stack">
          {characters.map(character => (
            <Button variant="secondary" block className="entry-character-picker__choice" key={character.id} disabled={loading} onClick={() => onSelect(character)}>
              <img className="squircle-media" src={character.image_url || DEFAULT_AVATAR} alt="" />
              <span className="entry-character-picker__details">
                <span>{character.name}</span>
                {character.description && <small>{character.description}</small>}
              </span>
            </Button>
          ))}
        </div>
        {characters.length === 0 && <div className="room-panel-empty">먼저 사용할 캐릭터를 만들어 주세요.</div>}
        <Button variant="secondary" block className="entry-character-picker__cancel" onClick={onClose} disabled={loading}>취소</Button>
      </Card>
    </div>
  )
}
