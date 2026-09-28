import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnimatedMessageText from './AnimatedMessageText'
import { DEFAULT_TEXT_EFFECT_SETTINGS } from '../features/messages/textEffectSettings'

describe('AnimatedMessageText', () => {
  it('keeps twist geometry stable when the parent rerenders', () => {
    const settings = {
      ...DEFAULT_TEXT_EFFECT_SETTINGS,
      animate: false,
      modifiers: ['twist'],
    }
    const props = { text: '형태가 고정된 대사', settings, messageId: 'message-1' }
    const { container, rerender } = render(<AnimatedMessageText {...props} renderFinal={() => '첫 렌더'} />)
    const transforms = () => [...container.querySelectorAll('[aria-hidden="true"]')].map(node => node.style.transform)
    const firstGeometry = transforms()

    rerender(<AnimatedMessageText {...props} renderFinal={() => '입력창 변경으로 다시 렌더'} />)

    expect(transforms()).toEqual(firstGeometry)
  })

  it('continues a long composition after the bubble entrance prop turns off', () => {
    vi.useFakeTimers()
    const settings = { ...DEFAULT_TEXT_EFFECT_SETTINGS, speed: 0.5 }
    const props = { text: '긴 문장도 끝까지 차례대로 조합된다', settings, messageId: 'message-2' }
    const { container, rerender } = render(<AnimatedMessageText {...props} animateOnMount />)
    const visibleText = () => container.querySelector('[data-text-effect]')?.textContent || ''

    expect(visibleText()).not.toContain(props.text)
    rerender(<AnimatedMessageText {...props} animateOnMount={false} />)
    expect(visibleText()).not.toContain(props.text)

    act(() => vi.runAllTimers())
    expect(visibleText()).toContain(props.text)
    vi.useRealTimers()
  })
})
