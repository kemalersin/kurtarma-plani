import { describe, expect, it } from 'vitest'
import { useAnyDrawerOpen, useDrawerStack } from '@/composables/useDrawerStack'

describe('useDrawerStack visual block', () => {
  it('FAB bloğu kapanış animasyonu bitene kadar sürer', () => {
    const drawer = useDrawerStack('test-drawer')
    const anyOpen = useAnyDrawerOpen()

    drawer.push()
    expect(anyOpen.value).toBe(true)

    drawer.pop()
    expect(anyOpen.value).toBe(true)

    drawer.releaseVisual()
    expect(anyOpen.value).toBe(false)
  })

  it('releaseVisual yalnızca ilgili drawer için bloğu kaldırır', () => {
    const top = useDrawerStack('top')
    const bottom = useDrawerStack('bottom')
    const anyOpen = useAnyDrawerOpen()

    bottom.push()
    top.push()
    expect(anyOpen.value).toBe(true)

    top.pop()
    top.releaseVisual()
    expect(anyOpen.value).toBe(true)

    bottom.pop()
    bottom.releaseVisual()
    expect(anyOpen.value).toBe(false)
  })
})
