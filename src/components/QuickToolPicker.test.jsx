import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QuickToolPicker from './QuickToolPicker'

const theme = { panel: '#181818', border: '#444444', point: '#8b7cff', subText: '#aaaaaa' }
const Icon = () => <svg aria-hidden="true" />

afterEach(cleanup)

describe('QuickToolPicker', () => {
  it('즐겨찾기가 하나뿐이면 선택 목록을 표시하지 않는다', () => {
    const { container } = render(
      <QuickToolPicker tools={[{ id: 'narration', label: '나레이션', icon: Icon }]} activeId="narration" theme={theme} onSelect={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('여러 즐겨찾기 중 현재 도구를 표시하고 다른 도구를 선택한다', () => {
    const onSelect = vi.fn()
    const { getByRole } = render(
      <QuickToolPicker
        tools={[
          { id: 'narration', label: '나레이션', icon: Icon },
          { id: 'effects', label: '대사 연출', icon: Icon },
        ]}
        activeId="narration"
        theme={theme}
        onSelect={onSelect}
      />
    )

    expect(getByRole('button', { name: '나레이션 선택' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(getByRole('button', { name: '대사 연출 선택' }))
    expect(onSelect).toHaveBeenCalledWith('effects')
  })
})

