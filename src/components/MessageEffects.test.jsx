import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageEffectBubble, MessageEffectPicker } from './MessageEffects'

const theme = {
  bg: '#111111',
  border: '#333333',
  panel: '#222222',
  point: '#8b5cf6',
  subText: '#aaaaaa',
  theirText: '#ffffff',
}

describe('MessageEffectPicker', () => {
  it('exposes an immediate selection action and a way back to the chat', () => {
    const onSelect = vi.fn()
    const onBack = vi.fn()
    render(
      <MessageEffectPicker
        selectedEffect={null}
        onSelect={onSelect}
        onBack={onBack}
        theme={theme}
      />
    )

    const shout = screen.getByRole('button', { name: /외침/ })
    const impact = screen.getByRole('button', { name: /충격/ })
    const back = screen.getByRole('button', { name: '대화 화면으로 돌아가기' })
    expect(screen.getAllByRole('button')).toEqual([back, shout, impact])

    fireEvent.click(shout)
    fireEvent.click(impact)
    fireEvent.click(back)

    expect(onSelect.mock.calls).toEqual([['shout'], ['impact']])
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('MessageEffectBubble', () => {
  it('waits for the message entrance before playing the selected effect', () => {
    vi.useFakeTimers()
    const onEffectPlay = vi.fn()
    const { container } = render(
      <MessageEffectBubble effectKey="impact" animateOnMount onEffectPlay={onEffectPlay}>
        순서대로 재생
      </MessageEffectBubble>
    )

    expect(container.firstChild).not.toHaveClass('message-effect--playing')
    act(() => vi.advanceTimersByTime(259))
    expect(onEffectPlay).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(container.firstChild).toHaveClass('message-effect--playing')
    expect(onEffectPlay).toHaveBeenCalledWith('impact')
    vi.useRealTimers()
  })

  it('restarts a stored effect when the message is clicked', () => {
    const { container } = render(
      <MessageEffectBubble effectKey="impact">다시 재생</MessageEffectBubble>
    )
    const initialBubble = container.firstChild

    fireEvent.click(within(container).getByRole('button', { name: '충격 효과 다시 보기' }))

    const replayedBubble = container.firstChild
    expect(replayedBubble).not.toBe(initialBubble)
    expect(replayedBubble).toHaveClass('message-effect--impact', 'message-effect--playing')
  })

  it('does not replay after a long-press interaction consumes the click', () => {
    const canReplay = vi.fn(() => false)
    const { container } = render(
      <MessageEffectBubble effectKey="shout" canReplay={canReplay}>
        길게 누름
      </MessageEffectBubble>
    )

    fireEvent.click(screen.getByRole('button', { name: '외침 효과 다시 보기' }))

    expect(canReplay).toHaveBeenCalledOnce()
    expect(container.firstChild).not.toHaveClass('message-effect--playing')
  })

  it('shows a tiny effect sparkle on the requested side of the bubble', () => {
    const { container } = render(
      <MessageEffectBubble effectKey="shout" indicatorSide="left">
        표시되는 효과
      </MessageEffectBubble>
    )

    expect(container.firstChild).toHaveAttribute('data-effect-indicator', 'sparkle')
    expect(container.firstChild).not.toHaveAttribute('data-effect-label')
    expect(container.firstChild).toHaveClass('message-effect--indicator-left')
  })

  it.each(['whisper', 'tremble', 'monologue'])(
    'renders a stored %s effect as a plain message',
    effectKey => {
      const { container } = render(
        <MessageEffectBubble effectKey={effectKey} animateOnMount className="message-bubble">
          과거 메시지 본문
        </MessageEffectBubble>
      )

      const bubble = container.firstChild
      expect(bubble).toHaveTextContent('과거 메시지 본문')
      expect(bubble).toHaveAttribute('class', 'message-bubble')
      expect(bubble).not.toHaveAttribute('data-effect-indicator')
      expect(bubble).not.toHaveAttribute('tabindex')
      expect(within(container).queryByRole('button')).not.toBeInTheDocument()
    }
  )
})
