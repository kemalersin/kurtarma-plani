import { computed, ref, type ComputedRef } from 'vue'
import { isVisibleOverlay } from '@/composables/mobileChildOverlay'

const visibleModalCount = ref(0)

function countVisibleModals(): number {
  let count = 0

  document.querySelectorAll('.ant-modal-root').forEach((root) => {
    const wrap = root.querySelector('.ant-modal-wrap')
    if (wrap && isVisibleOverlay(wrap)) count += 1
  })

  return count
}

/** AntDV `<Modal>` / `Modal.confirm` vb. görünür mü. */
export function useAnyModalOpen(): ComputedRef<boolean> {
  return computed(() => visibleModalCount.value > 0)
}

/** Portallara eklenen modal katmanlarını izler. */
export function initModalOverlayWatch(): () => void {
  if (typeof window === 'undefined') return () => {}

  let observer: MutationObserver | null = null
  let raf = 0

  const scheduleUpdate = (): void => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      visibleModalCount.value = countVisibleModals()
    })
  }

  const start = (): void => {
    if (observer) return
    scheduleUpdate()
    observer = new MutationObserver(scheduleUpdate)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    })
  }

  const stop = (): void => {
    observer?.disconnect()
    observer = null
    cancelAnimationFrame(raf)
    visibleModalCount.value = 0
  }

  start()

  return stop
}
