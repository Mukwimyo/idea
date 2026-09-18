import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RoomGroupPicker from './RoomGroupPicker'

const theme = {
  bg: '#111111',
  border: '#333333',
  inputText: '#ffffff',
  point: '#7f77dd',
  subText: '#aaaaaa',
}

afterEach(cleanup)

describe('RoomGroupPicker', () => {
  it('selects an existing group', () => {
    const onChange = vi.fn()
    const { getByRole } = render(
      <RoomGroupPicker
        groups={[{ id: 'space', name: '우주모험' }]}
        value={null}
        onChange={onChange}
        theme={theme}
      />
    )

    fireEvent.change(getByRole('combobox'), { target: { value: 'space' } })
    expect(onChange).toHaveBeenCalledWith('space')
  })

  it('only offers unassigned and existing groups', () => {
    const { getAllByRole, queryByRole } = render(
      <RoomGroupPicker groups={[{ id: 'space', name: '우주모험' }]} value={null} onChange={vi.fn()} theme={theme} />
    )

    expect(getAllByRole('option').map(option => option.textContent)).toEqual(['미분류', '우주모험'])
    expect(queryByRole('button', { name: /새 그룹/ })).toBeNull()
  })
})
