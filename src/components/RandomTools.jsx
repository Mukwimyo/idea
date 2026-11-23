import { useEffect, useState } from 'react'
import { Check, Crown, Dices, Percent, Scissors, Shuffle, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, IconButton, TextInput } from './ui'

function randomInt(max) {
  if (max <= 1) return 0
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % max
}

function pickOne(items) {
  return items[randomInt(items.length)]
}

function shuffled(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

const TOOL_TABS = [
  ['dice', '주사위', Dices],
  ['chance', '성공·실패', Percent],
  ['character', '캐릭터', Shuffle],
  ['king', '왕게임', Crown],
  ['rps', '가위바위보', Scissors],
]

export default function RandomTools({ open, roomId, onClose, onShare }) {
  const [tab, setTab] = useState('dice')
  const [characters, setCharacters] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [diceCount, setDiceCount] = useState(1)
  const [successChance, setSuccessChance] = useState(50)
  const [avoidRepeat, setAvoidRepeat] = useState(false)
  const [lastCharacterId, setLastCharacterId] = useState(null)
  const [kingCommand, setKingCommand] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let active = true
    const load = async () => {
      setError('')
      const [{ data: poolRows, error: poolError }, { data: messageRows, error: messageError }] = await Promise.all([
        supabase
          .from('room_characters')
          .select('character_id, sort_order, characters(id, name, image_url, color)')
          .eq('room_id', roomId)
          .order('sort_order'),
        supabase
          .from('messages')
          .select('character_id, characters(id, name, image_url, color)')
          .eq('room_id', roomId)
          .not('character_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      if (!active) return
      const characterFromRow = row => Array.isArray(row.characters) ? row.characters[0] : row.characters
      const unique = [...new Map([...(poolRows || []), ...(messageRows || [])]
        .map(characterFromRow)
        .filter(Boolean)
        .map(character => [character.id, character])).values()]
      setCharacters(unique)
      setSelectedIds(new Set(unique.map(character => character.id)))
      if (poolError && messageError) setError('방 캐릭터 목록을 불러오지 못했어요.')
    }
    load()
    return () => { active = false }
  }, [open, roomId])

  if (!open) return null
  const selectedCharacters = characters.filter(character => selectedIds.has(character.id))
  const toggleCharacter = id => setSelectedIds(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const createDiceResult = () => {
    const rolls = Array.from({ length: diceCount }, () => randomInt(6) + 1)
    return { kind: 'dice', rolls, total: rolls.reduce((sum, value) => sum + value, 0), diceCount }
  }
  const createChanceResult = () => {
    const roll = randomInt(100) + 1
    return { kind: 'chance', success: roll <= successChance }
  }
  const createCharacterResult = () => {
    let candidates = selectedCharacters
    if (avoidRepeat && candidates.length > 1) candidates = candidates.filter(character => character.id !== lastCharacterId)
    if (candidates.length === 0) return null
    const character = pickOne(candidates)
    setLastCharacterId(character.id)
    return { kind: 'character', character }
  }
  const createKingResult = () => {
    if (selectedCharacters.length < 2) return null
    const participants = shuffled(selectedCharacters)
    const king = participants[0]
    return { kind: 'king', king, assignments: participants.slice(1).map((character, index) => ({ number: index + 1, character })), command: kingCommand.trim() }
  }
  const createRpsResult = () => {
    if (selectedCharacters.length < 2) return null
    const hands = ['가위', '바위', '보']
    const plays = selectedCharacters.map(character => ({ character, hand: hands[randomInt(hands.length)] }))
    const appeared = new Set(plays.map(play => play.hand))
    let winningHand = null
    if (appeared.size === 2) {
      if (appeared.has('가위') && appeared.has('보')) winningHand = '가위'
      else if (appeared.has('바위') && appeared.has('가위')) winningHand = '바위'
      else winningHand = '보'
    }
    return { kind: 'rps', plays, winners: winningHand ? plays.filter(play => play.hand === winningHand).map(play => play.character) : [] }
  }
  const createResult = () => tab === 'dice' ? createDiceResult() : tab === 'chance' ? createChanceResult() : tab === 'character' ? createCharacterResult() : tab === 'king' ? createKingResult() : createRpsResult()
  const shareNow = () => {
    const next = createResult()
    if (!next) return setError(tab === 'king' || tab === 'rps' ? '캐릭터를 2명 이상 선택해주세요.' : '추첨할 캐릭터를 선택해주세요.')
    onShare(next)
    onClose()
  }

  const characterPicker = (
    <div className="room-panel-stack">
      <div className="room-panel-row random-tools__selection">
        <strong>참여 캐릭터 <span>{selectedCharacters.length}/{characters.length}</span></strong>
        <Button variant="secondary" className="random-tools__selection-action" disabled={characters.length === 0 || selectedIds.size === characters.length} onClick={() => setSelectedIds(new Set(characters.map(character => character.id)))}>전체 선택</Button>
        <Button variant="secondary" className="random-tools__selection-action" disabled={selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}>선택 해제</Button>
      </div>
      {characters.length === 0 ? (
        <div className="room-panel-empty random-tools__empty">이 방에 등록되었거나 대화에 등장한 캐릭터가 없어요.</div>
      ) : (
        <div className="room-panel-tabs">
          {characters.map(character => {
            const selected = selectedIds.has(character.id)
            return (
              <Button key={character.id} variant="secondary" onClick={() => toggleCharacter(character.id)} aria-pressed={selected} className="random-tools__character">
                <img src={character.image_url || `${import.meta.env.BASE_URL}default-avatar.png`} alt="" className="squircle-media" />
                <span>{character.name}</span>
                {selected && <Check size={14} />}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div onPointerDown={event => event.target === event.currentTarget && onClose()} className="room-sheet-backdrop random-tools-backdrop">
      <Card as="section" className="room-sheet random-tools">
        <header className="room-panel-header">
          <Sparkles size={18} />
          <strong className="room-panel-title">랜덤 도구</strong>
          <IconButton type="button" label="닫기" className="room-panel-icon" onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="room-panel-tabs random-tools__tabs">
          {TOOL_TABS.map(([id, label, Icon]) => (
            <Button key={id} variant="secondary" className="room-panel-tab" data-selected={tab === id} onClick={() => { setTab(id); setError('') }}>
              <Icon size={15} />{label}
            </Button>
          ))}
        </div>

        {tab === 'dice' && (
          <div className="room-panel-stack">
            <div className="room-panel-caption">D6 주사위 개수</div>
            <div className="room-panel-row random-tools__range-row">
              <input className="room-panel-range" type="range" min="1" max="10" value={diceCount} onChange={event => setDiceCount(Number(event.target.value))} />
              <strong>{diceCount}개</strong>
            </div>
          </div>
        )}
        {tab === 'chance' && (
          <div className="room-panel-stack">
            <div className="room-panel-caption">성공 확률</div>
            <div className="room-panel-row random-tools__range-row">
              <input className="room-panel-range" type="range" min="0" max="100" step="5" value={successChance} onChange={event => setSuccessChance(Number(event.target.value))} />
              <strong className="random-tools__chance">{successChance}%</strong>
            </div>
          </div>
        )}
        {tab === 'character' && (
          <div className="room-panel-stack">
            {characterPicker}
            <label className="random-tools__repeat">
              <input type="checkbox" checked={avoidRepeat} onChange={event => setAvoidRepeat(event.target.checked)} />
              같은 캐릭터 연속 당첨 방지
            </label>
          </div>
        )}
        {tab === 'king' && (
          <div className="room-panel-stack">
            {characterPicker}
            <TextInput value={kingCommand} onChange={event => setKingCommand(event.target.value)} placeholder="왕의 명령 (선택)" maxLength={160} />
          </div>
        )}
        {tab === 'rps' && (
          <div className="room-panel-stack">
            {characterPicker}
            <div className="room-panel-caption">선택한 캐릭터마다 가위·바위·보를 무작위로 배정해 승자를 정해요.</div>
          </div>
        )}
        {error && <div className="room-panel-error random-tools__error">{error}</div>}
        <Button block className="random-tools__share" onClick={shareNow}>결과 공유</Button>
      </Card>
    </div>
  )
}
