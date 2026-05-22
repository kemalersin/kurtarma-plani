import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEntitiesStore } from '@/stores/entities'

describe('entities store sensitive flag', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('isSensitiveById false when unknown', () => {
    const store = useEntitiesStore()
    expect(store.isSensitiveById('missing-id')).toBe(false)
  })

  it('isSensitive type-scoped', () => {
    const store = useEntitiesStore()
    expect(store.isSensitive('bank', 'x')).toBe(false)
  })
})
