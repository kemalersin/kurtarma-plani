import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import {
  isHistoryBack,
  scrollPositionKey,
  shouldResetScrollOnNavigate,
} from '@/router/scrollRestore'

function route(name: string | undefined, fullPath = `/${name ?? ''}`): RouteLocationNormalized {
  return { name, fullPath } as RouteLocationNormalized
}

describe('shouldResetScrollOnNavigate', () => {
  it('farklı route adında sıfırlar', () => {
    expect(shouldResetScrollOnNavigate(route('debts'), route('home'))).toBe(true)
  })

  it('aynı route adında yalnızca query değişiminde sıfırlamaz', () => {
    expect(shouldResetScrollOnNavigate(route('settings'), route('settings'))).toBe(false)
  })
})

describe('scrollPositionKey', () => {
  it('fullPath kullanır', () => {
    expect(scrollPositionKey(route('debts', '/debts?tab=cards'))).toBe('/debts?tab=cards')
  })
})

describe('isHistoryBack', () => {
  it('history pozisyonu azaldığında geri sayar', () => {
    expect(isHistoryBack(1, 2)).toBe(true)
  })

  it('history pozisyonu artınca veya aynı kalınca geri saymaz', () => {
    expect(isHistoryBack(2, 1)).toBe(false)
    expect(isHistoryBack(2, 2)).toBe(false)
  })
})
