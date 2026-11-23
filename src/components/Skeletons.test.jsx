import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CharacterListSkeleton, RoomListSkeleton, RoomSkeleton } from './Skeletons'

afterEach(cleanup)

it.each([
  ['room list', <RoomListSkeleton />, '.room-list-card', 4],
  ['room', <RoomSkeleton />, '.message-text-bubble', 6],
  ['character list', <CharacterListSkeleton />, '.character-list-item', 4],
  ['room character list', <CharacterListSkeleton room />, '.character-list-item', 4],
])('renders the %s loading status and its placeholder items', (_, skeleton, selector, count) => {
  render(skeleton)

  const status = screen.getByRole('status', { name: '불러오는 중' })
  expect(status).toHaveAttribute('aria-busy', 'true')
  expect(status).toHaveTextContent(/^$/)
  expect(status.querySelectorAll(selector)).toHaveLength(count)
  expect(status.querySelector('.ui-skeleton:not([aria-hidden="true"])')).toBeNull()
})

it('alternates room bubbles between the left and right sides', () => {
  render(<RoomSkeleton />)

  const rows = screen.getByRole('status').querySelectorAll('.message-row--chat')
  expect(Array.from(rows, row => row.classList.contains('message-row--mine'))).toEqual([
    false, true, false, true, false, true,
  ])
})
