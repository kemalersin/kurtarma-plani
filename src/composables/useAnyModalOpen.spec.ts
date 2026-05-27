/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach } from 'vitest'
import { initModalOverlayWatch, useAnyModalOpen } from '@/composables/useAnyModalOpen'

describe('useAnyModalOpen', () => {
  let stopWatch: (() => void) | undefined

  afterEach(() => {
    stopWatch?.()
    stopWatch = undefined
    document.body.innerHTML = ''
  })

  it('useAnyModalOpen false when no modal in DOM', () => {
    stopWatch = initModalOverlayWatch()
    expect(useAnyModalOpen().value).toBe(false)
  })

  it('useAnyModalOpen true when visible ant-modal-wrap exists', async () => {
    stopWatch = initModalOverlayWatch()

    const root = document.createElement('div')
    root.className = 'ant-modal-root'
    const wrap = document.createElement('div')
    wrap.className = 'ant-modal-wrap'
    wrap.style.cssText = 'display:block;width:100px;height:100px;'
    wrap.getBoundingClientRect = () =>
      ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    root.appendChild(wrap)
    document.body.appendChild(root)

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    expect(useAnyModalOpen().value).toBe(true)
  })

  it('useAnyModalOpen false when modal wrap is hidden', async () => {
    stopWatch = initModalOverlayWatch()

    const root = document.createElement('div')
    root.className = 'ant-modal-root'
    const wrap = document.createElement('div')
    wrap.className = 'ant-modal-wrap'
    wrap.setAttribute('aria-hidden', 'true')
    wrap.style.cssText = 'display:block;width:100px;height:100px;'
    root.appendChild(wrap)
    document.body.appendChild(root)

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    expect(useAnyModalOpen().value).toBe(false)
  })
})
