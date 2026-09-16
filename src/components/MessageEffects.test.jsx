import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageEffectBubble } from './MessageEffects'

describe('MessageEffectBubble', () => {
  it('restarts a stored effect when the message is clicked', () => {
    const { container } = render(
      <MessageEffectBubble effectKey="impact">다시 재생</MessageEffectBubble>
    )
    const initialBubble = container.firstChild

    fireEvent.click(screen.getByRole('button', { name: '충격 효과 다시 보기' }))

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
})
