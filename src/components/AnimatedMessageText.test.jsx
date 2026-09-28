import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
