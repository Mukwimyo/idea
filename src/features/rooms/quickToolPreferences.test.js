import { describe, expect, it, vi } from 'vitest'
import {
  FAVORITE_TOOLS_STORAGE_KEY,
  QUICK_TOOL_STORAGE_KEY,
  readQuickToolPreferences,
  toggleFavoriteTool,
  writeQuickToolPreferences,
} from './quickToolPreferences'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    value: key => values.get(key),
  }
}

describe('quick tool preferences', () => {
  it('기존 단일 빠른 도구를 첫 즐겨찾기로 이전한다', () => {
    const storage = createStorage({ [QUICK_TOOL_STORAGE_KEY]: 'effects' })
    expect(readQuickToolPreferences(storage)).toEqual({ activeId: 'effects', favorites: ['effects'] })
  })

  it('손상되거나 알 수 없는 즐겨찾기는 안전하게 정리한다', () => {
    const storage = createStorage({
      [QUICK_TOOL_STORAGE_KEY]: 'unknown',
      [FAVORITE_TOOLS_STORAGE_KEY]: JSON.stringify(['image', 'image', 'unknown', 'random']),
    })
    expect(readQuickToolPreferences(storage)).toEqual({ activeId: 'image', favorites: ['image', 'random'] })
  })

  it('즐겨찾기를 추가하면 그 도구를 현재 빠른 도구로 선택한다', () => {
    expect(toggleFavoriteTool({ activeId: 'narration', favorites: ['narration'] }, 'effects')).toEqual({
      activeId: 'effects', favorites: ['narration', 'effects'], changed: true,
    })
  })

  it('마지막 즐겨찾기는 제거하지 않는다', () => {
    expect(toggleFavoriteTool({ activeId: 'narration', favorites: ['narration'] }, 'narration')).toEqual({
      activeId: 'narration', favorites: ['narration'], changed: false,
    })
  })

  it('현재 도구를 제거하면 남은 첫 도구로 전환하고 저장한다', () => {
    const storage = createStorage()
    const next = toggleFavoriteTool({ activeId: 'effects', favorites: ['narration', 'effects'] }, 'effects')
    expect(writeQuickToolPreferences(storage, next)).toEqual({ activeId: 'narration', favorites: ['narration'] })
    expect(storage.value(QUICK_TOOL_STORAGE_KEY)).toBe('narration')
    expect(storage.value(FAVORITE_TOOLS_STORAGE_KEY)).toBe('["narration"]')
  })
})

