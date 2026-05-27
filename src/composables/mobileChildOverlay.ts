import { computed, ref } from 'vue'
import { KP_MOBILE_VIEWPORT_MQ } from '@/composables/useMatchMedia'

const registeredDepth = ref(0)
const domOverlayDepth = ref(0)

/** Mobilde drawer üstündeki sheet, modal, popover vb. katman sayısı. */
export const mobileChildOverlayDepth = computed(
  () => registeredDepth.value + domOverlayDepth.value,
)

/** Bilinen overlay bileşenleri (KpSelect sheet vb.) açılış/kapanışta çağırır. */
export function registerMobileChildOverlay(): () => void {
  registeredDepth.value += 1
  return () => {
    registeredDepth.value = Math.max(0, registeredDepth.value - 1)
  }
}

export function isVisibleOverlay(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (
    el.classList.contains('ant-popover-hidden') ||
    el.classList.contains('ant-select-dropdown-hidden') ||
    el.classList.contains('ant-picker-dropdown-hidden') ||
    el.classList.contains('ant-dropdown-hidden')
  ) {
    return false
  }
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 || rect.height > 0
}

function countDomOverlays(): number {
  let count = 0

  document.querySelectorAll('.ant-modal-root').forEach((root) => {
    const wrap = root.querySelector('.ant-modal-wrap')
    if (wrap && isVisibleOverlay(wrap)) count += 1
  })

  document.querySelectorAll('.ant-popover').forEach((el) => {
    if (isVisibleOverlay(el)) count += 1
  })

  document.querySelectorAll('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown').forEach(
    (el) => {
      if (isVisibleOverlay(el)) count += 1
    },
  )

  return count
}

/** AntDV modal/popover/dropdown gibi portalları izler; yalnızca mobil viewport'ta. */
export function initMobileChildOverlayWatch(): () => void {
  if (typeof window === 'undefined') return () => {}

  let mq = window.matchMedia(KP_MOBILE_VIEWPORT_MQ)
  let observer: MutationObserver | null = null
  let raf = 0

  const scheduleUpdate = (): void => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      if (!mq.matches) {
        domOverlayDepth.value = 0
        return
      }
      domOverlayDepth.value = countDomOverlays()
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
    domOverlayDepth.value = 0
  }

  const sync = (): void => {
    if (mq.matches) start()
    else stop()
  }

  sync()
  mq.addEventListener('change', sync)

  return () => {
    mq.removeEventListener('change', sync)
    stop()
  }
}
