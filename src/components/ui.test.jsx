import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'
import { Button, Dialog, IconButton, TextArea, TextInput, Toggle } from './ui'

afterEach(cleanup)

describe('Button', () => {
  it('defaults to a primary button and forwards its ref', () => {
    const ref = createRef()
    render(<Button ref={ref}>저장</Button>)
    const button = screen.getByRole('button', { name: '저장' })

    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('ui-btn', 'ui-btn--primary')
    expect(ref.current).toBe(button)
  })

  it.each(['secondary', 'ghost', 'danger'])('applies the %s variant and preserves button props', variant => {
    render(<Button type="submit" variant={variant} size="sm" block className="custom">저장</Button>)
    const button = screen.getByRole('button', { name: '저장' })

    expect(button).toHaveClass('ui-btn', `ui-btn--${variant}`, 'ui-btn--sm', 'ui-btn--block', 'custom')
    expect(button).toHaveAttribute('type', 'submit')
  })
})

it('preserves the colors, size and event handler passed to the RoomList icon button', () => {
  const onClick = vi.fn()
  render(
    <IconButton
      label="대화방 메뉴"
      borderColor="transparent"
      pointColor="#7f77dd"
      color="#aaaaaa"
      style={{ width: 44, height: 44 }}
      onClick={onClick}
    />,
  )
  const button = screen.getByRole('button', { name: '대화방 메뉴' })

  expect(button.style.getPropertyValue('--ui-icon-btn-border')).toBe('transparent')
  expect(button.style.getPropertyValue('--ui-icon-btn-point')).toBe('#7f77dd')
  expect(button.style.getPropertyValue('--ui-icon-btn-color')).toBe('#aaaaaa')
  expect(button).toHaveStyle({ width: '44px', height: '44px' })
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledOnce()
})

it.each([TextInput, TextArea])('forwards its ref to the input element', Component => {
  const ref = createRef()
  render(<Component ref={ref} aria-label="내용" />)

  expect(ref.current).toBe(screen.getByRole('textbox', { name: '내용' }))
  expect(ref.current).toHaveClass('ui-input')
})

describe('Toggle', () => {
  it.each([false, true])('reflects checked=%s and requests the next value', checked => {
    const onChange = vi.fn()
    render(<Toggle label="알림" checked={checked} onChange={onChange} />)
    const toggle = screen.getByRole('switch', { name: '알림', checked })

    expect(toggle).toHaveAttribute('aria-checked', String(checked))
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledExactlyOnceWith(!checked)
  })

  it('does not request a change when disabled', () => {
    const onChange = vi.fn()
    render(<Toggle label="알림" checked={false} onChange={onChange} disabled />)
    const toggle = screen.getByRole('switch', { name: '알림' })

    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Dialog', () => {
  it('focuses the panel on open, requests cancellation on Escape, and restores focus on close', async () => {
    const onCancel = vi.fn()
    const view = open => (
      <>
        <button type="button">열기</button>
        <Dialog open={open} title="안내" onCancel={onCancel} closeOnBackdrop={false} />
      </>
    )
    const { rerender } = render(view(false))
    const trigger = screen.getByRole('button', { name: '열기' })
    trigger.focus()

    rerender(view(true))
    const dialog = screen.getByRole('dialog', { name: '안내' })
    await waitFor(() => expect(dialog).toHaveFocus())

    fireEvent.mouseDown(dialog.parentElement)
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()

    rerender(view(false))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('ConfirmDialog', () => {
  it('keeps the alertdialog labels, confirm focus and backdrop cancellation', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="대화방 삭제"
        description="삭제한 대화방은 복구할 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    const dialog = screen.getByRole('alertdialog', { name: '대화방 삭제' })
    const confirm = within(dialog).getByRole('button', { name: '삭제' })
    expect(dialog).toHaveAccessibleDescription('삭제한 대화방은 복구할 수 없습니다.')
    expect(confirm).toHaveClass('ui-btn--danger')
    await waitFor(() => expect(confirm).toHaveFocus())

    fireEvent.mouseDown(confirm)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.mouseDown(dialog.parentElement)
    fireEvent.keyDown(confirm, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
