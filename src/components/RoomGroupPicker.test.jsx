import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
        onCreate={vi.fn()}
        theme={theme}
      />
    )

    fireEvent.change(getByRole('combobox'), { target: { value: 'space' } })
    expect(onChange).toHaveBeenCalledWith('space')
  })

  it('creates and selects a new group inline', async () => {
    const onChange = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 'school', name: '판타지 학원' })
    const { getByPlaceholderText, getByRole } = render(
      <RoomGroupPicker
        groups={[]}
        value={null}
        onChange={onChange}
        onCreate={onCreate}
        theme={theme}
      />
    )

    fireEvent.click(getByRole('button', { name: /새 그룹/ }))
    fireEvent.change(getByPlaceholderText('예) 우주모험'), { target: { value: '판타지 학원' } })
    fireEvent.click(getByRole('button', { name: '추가' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('판타지 학원'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('school'))
  })
})
