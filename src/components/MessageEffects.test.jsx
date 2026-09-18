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
  it('exposes an immediate selection action and a way back to the tool menu', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /충격/ }))
    fireEvent.click(screen.getByRole('button', { name: '대화 도구로 돌아가기' }))

    expect(onSelect).toHaveBeenCalledWith('impact')
    expect(onBack).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /독백/ })).not.toBeInTheDocument()
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
      <MessageEffectBubble effectKey="whisper" canReplay={canReplay}>
        길게 누름
      </MessageEffectBubble>
    )

    fireEvent.click(screen.getByRole('button', { name: '속삭임 효과 다시 보기' }))

    expect(canReplay).toHaveBeenCalledOnce()
    expect(container.firstChild).not.toHaveClass('message-effect--playing')
  })

  it('shows a tiny effect label on the requested side of the bubble', () => {
    const { container } = render(
      <MessageEffectBubble effectKey="whisper" indicatorSide="left">
        표시되는 효과
      </MessageEffectBubble>
    )

    expect(container.firstChild).toHaveAttribute('data-effect-label', '속삭임')
    expect(container.firstChild).toHaveClass('message-effect--indicator-left')
  })
})
