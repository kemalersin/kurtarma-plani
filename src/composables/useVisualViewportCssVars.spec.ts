/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetVisualViewportCssVarsForTests,
  bindVisualViewportCssVars,
} from '@/composables/useVisualViewportCssVars'

describe('useVisualViewportCssVars', () => {
  afterEach(() => {
    __resetVisualViewportCssVarsForTests()
  })

  it('visualViewport yokken CSS değişkeni yazmaz', () => {
    const original = window.visualViewport
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })

    const release = bindVisualViewportCssVars()
    expect(document.documentElement.style.getPropertyValue('--kp-vv-height')).toBe('')

    release()
    Object.defineProperty(window, 'visualViewport', { value: original, configurable: true })
  })

  it('bind sırasında visualViewport ölçülerini yazar, release sonrası temizler', () => {
    const listeners = new Map<string, Set<() => void>>()
    const vv = {
      height: 420,
      offsetTop: 12,
      addEventListener(type: string, fn: () => void) {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(fn)
      },
      removeEventListener(type: string, fn: () => void) {
        listeners.get(type)?.delete(fn)
      },
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })

    const release = bindVisualViewportCssVars()
    expect(document.documentElement.style.getPropertyValue('--kp-vv-height')).toBe('420px')
    expect(document.documentElement.style.getPropertyValue('--kp-vv-offset-top')).toBe('12px')

    vv.height = 360
    vv.offsetTop = 48
    listeners.get('resize')?.forEach((fn) => fn())
    expect(document.documentElement.style.getPropertyValue('--kp-vv-height')).toBe('360px')
    expect(document.documentElement.style.getPropertyValue('--kp-vv-offset-top')).toBe('48px')

    release()
    expect(document.documentElement.style.getPropertyValue('--kp-vv-height')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--kp-vv-offset-top')).toBe('')
  })

  it('iç içe bind/release referans sayacını korur', () => {
    const vv = {
      height: 500,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })

    const releaseA = bindVisualViewportCssVars()
    const releaseB = bindVisualViewportCssVars()
    releaseA()
    expect(document.documentElement.style.getPropertyValue('--kp-vv-height')).toBe('500px')

    releaseB()
    expect(document.documentElement.style.getPropertyValue('--kp-vv-height')).toBe('')
  })
})
