import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import UiModeToggleCard from './UiModeToggleCard'

const theme = {
  panel: '#222222',
  border: '#444444',
  point: '#7f77dd',
  theirText: '#ffffff',
  subText: '#aaaaaa',
}

afterEach(cleanup)

describe('UiModeToggleCard', () => {
  it('turns modern mode on from classic mode', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<UiModeToggleCard mode="classic" onChange={onChange} theme={theme} />)
    const toggle = getByRole('switch', { name: '새 디자인 사용' })

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith('modern')
  })

  it('turns modern mode off', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<UiModeToggleCard mode="modern" onChange={onChange} theme={theme} />)

    fireEvent.click(getByRole('switch', { name: '새 디자인 사용' }))
    expect(onChange).toHaveBeenCalledWith('classic')
  })
})
