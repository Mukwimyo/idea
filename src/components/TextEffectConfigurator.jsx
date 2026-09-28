import { useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import AnimatedMessageText from './AnimatedMessageText'
import {
  DEFAULT_TEXT_EFFECT_SETTINGS,
  effectiveTextEffectSpeed,
  normalizeTextEffectSettings,
} from '../features/messages/textEffectSettings'

const ENTRY_OPTIONS = [
  ['instant', '즉시'], ['jamo', '자모 조합'], ['syllable', '한 음절씩'],
  ['decode', '해독'], ['hesitate', '머뭇거림'], ['correct', '고쳐 쓰기'],
]
const MODIFIER_OPTIONS = [['twist', '비틀림'], ['runaway', '폭주'], ['disconnect', '단절']]

export default function TextEffectConfigurator({ value, onChange, theme, sampleText = '안녕, 오늘은 어디로 갈까?' }) {
  const settings = normalizeTextEffectSettings(value)
  const [previewKey, setPreviewKey] = useState(0)
  const update = patch => onChange(normalizeTextEffectSettings({ ...settings, ...patch }))
  const toggleModifier = modifier => update({
    modifiers: settings.modifiers.includes(modifier)
      ? settings.modifiers.filter(item => item !== modifier)
      : [...settings.modifiers, modifier],
  })
  const speed = effectiveTextEffectSpeed(settings, [...sampleText].length)
  const buttonStyle = active => ({
    border: `1px solid ${active ? theme.point : theme.border}`,
    borderRadius: 9,
    padding: '8px 9px',
    color: active ? theme.theirText : theme.subText,
    background: active ? `${theme.point}22` : theme.bg,
    fontSize: 11,
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      <div style={{ minHeight: 112, padding: 18, borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.theirText, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: 10, color: theme.subText, fontSize: 10 }}>미리보기</div>
        <div style={{ fontSize: 15, lineHeight: 1.65, overflowWrap: 'anywhere' }}>
          <AnimatedMessageText key={previewKey} text={sampleText} settings={settings} messageId={`preview-${previewKey}`} animateOnMount />
        </div>
        <button type="button" onClick={() => setPreviewKey(key => key + 1)} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, border: 0, background: 'none', color: theme.subText, fontSize: 11, cursor: 'pointer' }}><Play size={13} /> 다시 보기</button>
      </div>

      <section>
        <div style={{ marginBottom: 7, color: theme.subText, fontSize: 11 }}>등장 방식</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {ENTRY_OPTIONS.map(([key, label]) => <button type="button" key={key} onClick={() => update({ entryMode: key })} style={buttonStyle(settings.entryMode === key)}>{label}</button>)}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 7, color: theme.subText, fontSize: 11 }}>등장 위치</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" onClick={() => update({ entryMotion: 'stationary' })} style={buttonStyle(settings.entryMotion === 'stationary')}>제자리</button>
          <button type="button" onClick={() => update({ entryMotion: 'rise' })} style={buttonStyle(settings.entryMotion === 'rise')}>아래에서</button>
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 7, color: theme.subText, fontSize: 11 }}>조합 효과 · 선택하지 않아도 됩니다</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {MODIFIER_OPTIONS.map(([key, label]) => <button type="button" key={key} onClick={() => toggleModifier(key)} style={buttonStyle(settings.modifiers.includes(key))}>{label}</button>)}
        </div>
      </section>

      {[
        ['intensity', '효과 강도', 0, 100, 1, settings.intensity],
        ['irregularity', '불규칙성', 0, 100, 1, settings.irregularity],
        ['letterSpacing', '글자 간격', -2, 6, 1, `${settings.letterSpacing}px`],
        ['speed', '기준 등장 속도', 0.5, 5, 0.5, `${settings.speed.toFixed(1)}x`],
      ].map(([key, label, min, max, step, output]) => (
        <label key={key} style={{ display: 'block' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: theme.subText, fontSize: 11 }}><span>{label}</span><strong style={{ color: theme.theirText }}>{output}</strong></span>
          <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => update({ [key]: Number(event.target.value) })} style={{ width: '100%', accentColor: theme.point }} />
        </label>
      ))}

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: theme.theirText, fontSize: 12 }}>
        긴 문장 자동 가속 <input type="checkbox" checked={settings.autoAccelerate} onChange={event => update({ autoAccelerate: event.target.checked })} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: theme.theirText, fontSize: 12 }}>
        등장 애니메이션 <input type="checkbox" checked={settings.animate} onChange={event => update({ animate: event.target.checked })} />
      </label>
      <div style={{ color: theme.subText, fontSize: 10 }}>현재 실효 속도 {speed.toFixed(1)}x · {sampleText.length}자</div>
      <button type="button" onClick={() => onChange({ ...DEFAULT_TEXT_EFFECT_SETTINGS, modifiers: [] })} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, border: 0, background: 'none', color: theme.subText, fontSize: 11, cursor: 'pointer' }}><RotateCcw size={13} /> 기본값으로 되돌리기</button>
    </div>
  )
}
