import { describe, expect, it, afterEach } from 'vitest'
import {
  mobileChildOverlayDepth,
  registerMobileChildOverlay,
} from '@/composables/mobileChildOverlay'

describe('mobileChildOverlay', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('registerMobileChildOverlay artan ve azalan sayaç tutar', () => {
    expect(mobileChildOverlayDepth.value).toBe(0)

    const releaseA = registerMobileChildOverlay()
    cleanups.push(releaseA)
    expect(mobileChildOverlayDepth.value).toBe(1)

    const releaseB = registerMobileChildOverlay()
    cleanups.push(releaseB)
    expect(mobileChildOverlayDepth.value).toBe(2)

    releaseA()
    cleanups.pop()
    expect(mobileChildOverlayDepth.value).toBe(1)

    releaseB()
    cleanups.pop()
    expect(mobileChildOverlayDepth.value).toBe(0)
  })
})
