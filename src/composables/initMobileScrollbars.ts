import { KP_MOBILE_VIEWPORT_MQ } from '@/composables/useMatchMedia'

const HIDE_DELAY_MS = 900

let active = false
let mq: MediaQueryList | null = null
const hideTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

function onScroll(event: Event): void {
  const el = event.target
  if (!(el instanceof HTMLElement)) return
  if (el === document.documentElement) return

  el.classList.add('kp-scrolling')
  const prev = hideTimers.get(el)
  if (prev) clearTimeout(prev)
  hideTimers.set(
    el,
    setTimeout(() => {
      el.classList.remove('kp-scrolling')
      hideTimers.delete(el)
    }, HIDE_DELAY_MS),
  )
}

function clearScrollingClasses(): void {
  document.querySelectorAll('.kp-scrolling').forEach((node) => {
    node.classList.remove('kp-scrolling')
  })
}

function enable(): void {
  if (active) return
  active = true
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
}

function disable(): void {
  if (!active) return
  active = false
  document.removeEventListener('scroll', onScroll, { capture: true })
  clearScrollingClasses()
}

/** Mobilde kaydırma çubuklarını yalnızca kaydırma sırasında göster (.kp-scrolling). */
export function initMobileScrollbars(): () => void {
  if (typeof window === 'undefined') return () => {}

  mq = window.matchMedia(KP_MOBILE_VIEWPORT_MQ)
  const sync = (): void => {
    if (mq?.matches) enable()
    else disable()
  }
  sync()
  mq.addEventListener('change', sync)

  return () => {
    mq?.removeEventListener('change', sync)
    disable()
    mq = null
  }
}
