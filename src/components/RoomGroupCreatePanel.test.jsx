import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RoomGroupCreatePanel from './RoomGroupCreatePanel'

const theme = {
  bg: '#111111',
  border: '#333333',
  inputText: '#ffffff',
  panel: '#222222',
  point: '#7f77dd',
  subText: '#aaaaaa',
}

afterEach(cleanup)

describe('RoomGroupCreatePanel', () => {
  it('creates a group and closes after success', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'space', name: '우주모험' })
    const onClose = vi.fn()
    const { getByLabelText, getByRole } = render(<RoomGroupCreatePanel onCreate={onCreate} onClose={onClose} theme={theme} />)

    fireEvent.change(getByLabelText('새 방 그룹 이름'), { target: { value: ' 우주모험 ' } })
    fireEvent.click(getByRole('button', { name: '추가' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('우주모험'))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('stays open when creation fails', async () => {
    const onClose = vi.fn()
    const { getByLabelText, getByRole } = render(<RoomGroupCreatePanel onCreate={vi.fn().mockResolvedValue(null)} onClose={onClose} theme={theme} />)

    fireEvent.change(getByLabelText('새 방 그룹 이름'), { target: { value: '중복 그룹' } })
    fireEvent.click(getByRole('button', { name: '추가' }))

    await waitFor(() => expect(getByRole('button', { name: '추가' })).not.toBeDisabled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
