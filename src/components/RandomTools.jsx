import { useEffect, useState } from 'react'
import { Check, Crown, Dices, Percent, Shuffle, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
]

export default function RandomTools({ open, roomId, theme, onClose, onShare }) {
  const [tab, setTab] = useState('dice')
  const [characters, setCharacters] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [diceCount, setDiceCount] = useState(1)
  const [successChance, setSuccessChance] = useState(50)
  const [avoidRepeat, setAvoidRepeat] = useState(false)
  const [lastCharacterId, setLastCharacterId] = useState(null)
  const [privateResult, setPrivateResult] = useState(null)
  const [kingCommand, setKingCommand] = useState('')
  const [error, setError] = useState('')
  const t = theme

  useEffect(() => {
    if (!open) return undefined
    let active = true
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from('room_characters')
        .select('character_id, sort_order, characters(id, name, image_url, color)')
        .eq('room_id', roomId)
        .order('sort_order')
      if (!active) return
      const unique = [...new Map((data || []).filter(row => row.characters).map(row => [row.characters.id, row.characters])).values()]
      setCharacters(unique)
      setSelectedIds(new Set(unique.map(character => character.id)))
      if (loadError) setError('방 캐릭터 목록을 불러오지 못했어요.')
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
    return { kind: 'chance', chance: successChance, roll, success: roll <= successChance }
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
  const createResult = () => tab === 'dice' ? createDiceResult() : tab === 'chance' ? createChanceResult() : tab === 'character' ? createCharacterResult() : createKingResult()
  const rollPrivate = () => {
    const result = createResult()
    if (!result) return setError(tab === 'king' ? '왕게임에는 캐릭터가 2명 이상 필요해요.' : '추첨할 캐릭터를 선택해주세요.')
    setError('')
    setPrivateResult(result)
  }
  const shareNow = result => {
    const next = result || createResult()
    if (!next) return setError(tab === 'king' ? '왕게임에는 캐릭터가 2명 이상 필요해요.' : '추첨할 캐릭터를 선택해주세요.')
    onShare(next)
    setPrivateResult(null)
    onClose()
  }

  const characterPicker = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
      {characters.map(character => {
        const selected = selectedIds.has(character.id)
        return <button key={character.id} onClick={() => toggleCharacter(character.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, padding: 7, borderRadius: 10, border: `1px solid ${selected ? t.point : t.border}`, background: selected ? `${t.point}18` : t.bg, color: t.theirText }}>
          <img src={character.image_url || `${import.meta.env.BASE_URL}default-avatar.png`} alt="" className="squircle-media" style={{ width: 28, height: 28, flexShrink: 0, objectFit: 'cover' }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', fontSize: 11 }}>{character.name}</span>
          {selected && <Check size={12} color={t.point} />}
        </button>
      })}
    </div>
  )

  return <div onPointerDown={event => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 175, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }}>
    <section className="ui-slide-up" style={{ width: '100%', maxWidth: 480, maxHeight: '84vh', overflowY: 'auto', padding: '14px 14px calc(18px + env(safe-area-inset-bottom))', borderRadius: '22px 22px 0 0', border: `1px solid ${t.border}`, background: t.panel, boxShadow: '0 -18px 48px rgba(0,0,0,.3)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} color={t.point} /><strong style={{ flex: 1, color: t.theirText, fontSize: 14 }}>랜덤 도구</strong><button onClick={onClose} style={{ width: 34, height: 34, border: 0, background: 'transparent', color: t.subText }}><X size={18} /></button></header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5, margin: '9px 0 13px' }}>{TOOL_TABS.map(([id, label, Icon]) => <button key={id} onClick={() => { setTab(id); setPrivateResult(null); setError('') }} style={{ display: 'grid', placeItems: 'center', gap: 5, padding: '8px 2px', borderRadius: 9, border: `1px solid ${tab === id ? t.point : t.border}`, background: tab === id ? `${t.point}20` : t.bg, color: tab === id ? t.point : t.subText, fontSize: 9 }}><Icon size={15} />{label}</button>)}</div>

      {tab === 'dice' && <div style={{ display: 'grid', gap: 9 }}><div style={{ color: t.subText, fontSize: 11 }}>D6 주사위 개수</div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="range" min="1" max="10" value={diceCount} onChange={event => setDiceCount(Number(event.target.value))} style={{ flex: 1, accentColor: t.point }} /><strong style={{ width: 34, color: t.theirText, textAlign: 'center' }}>{diceCount}개</strong></div></div>}
      {tab === 'chance' && <div style={{ display: 'grid', gap: 9 }}><div style={{ color: t.subText, fontSize: 11 }}>성공 확률</div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="range" min="0" max="100" step="5" value={successChance} onChange={event => setSuccessChance(Number(event.target.value))} style={{ flex: 1, accentColor: t.point }} /><strong style={{ width: 42, color: t.theirText, textAlign: 'right' }}>{successChance}%</strong></div></div>}
      {tab === 'character' && <div style={{ display: 'grid', gap: 9 }}>{characterPicker}<label style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.subText, fontSize: 10 }}><input type="checkbox" checked={avoidRepeat} onChange={event => setAvoidRepeat(event.target.checked)} />같은 캐릭터 연속 당첨 방지</label></div>}
      {tab === 'king' && <div style={{ display: 'grid', gap: 9 }}>{characterPicker}<input value={kingCommand} onChange={event => setKingCommand(event.target.value)} placeholder="왕의 명령 (선택)" maxLength={160} style={{ padding: 9, borderRadius: 9, border: `1px solid ${t.border}`, background: t.bg, color: t.inputText, outline: 'none' }} /></div>}

      {privateResult && <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: `1px solid ${t.point}`, background: `${t.point}14`, color: t.theirText, textAlign: 'center' }}>
        <div style={{ marginBottom: 5, color: t.subText, fontSize: 9 }}>나에게만 보이는 결과</div>
        {privateResult.kind === 'dice' && <><div style={{ fontSize: 18 }}>{privateResult.rolls.join(' · ')}</div><strong>합계 {privateResult.total}</strong></>}
        {privateResult.kind === 'chance' && <strong style={{ color: privateResult.success ? '#6ee7a8' : '#f87171', fontSize: 20 }}>{privateResult.success ? '성공' : '실패'}</strong>}
        {privateResult.kind === 'character' && <strong style={{ fontSize: 18 }}>{privateResult.character.name}</strong>}
        {privateResult.kind === 'king' && <><strong style={{ fontSize: 16 }}>왕 · {privateResult.king.name}</strong><div style={{ marginTop: 6, fontSize: 11 }}>{privateResult.assignments.map(item => `${item.number}번 ${item.character.name}`).join(' · ')}</div></>}
      </div>}
      {error && <div style={{ marginTop: 9, color: '#f87171', fontSize: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
        <button onClick={rollPrivate} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${t.border}`, background: t.bg, color: t.theirText }}>비공개로 실행</button>
        <button onClick={() => shareNow(privateResult)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 0, background: t.point, color: '#fff' }}>{privateResult ? '이 결과 공유' : '바로 공유'}</button>
      </div>
    </section>
  </div>
}
