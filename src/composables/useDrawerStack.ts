import { computed, ref, type ComputedRef, type CSSProperties } from 'vue'
import { KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'

interface DrawerSlot {
  id: string
}

const BASE_Z_INDEX = 1000
const STEP = 10
/** Üstte başka drawer varken alttaki panelin sola kayması (px / katman). */
export const DRAWER_STACK_OFFSET_PX = 44

const stack = ref<DrawerSlot[]>([])
/** Drawer kapanış animasyonu bitene kadar FAB / sayfalama hizasını bloke eder. */
const visualBlockIds = ref<Set<string>>(new Set())

/** Herhangi bir `FormDrawer` görünür mü (kapanış animasyonu dahil). */
export function useAnyDrawerOpen(): ComputedRef<boolean> {
  return computed(() => visualBlockIds.value.size > 0)
}

/**
 * Üst üste açılan `<a-drawer>` örnekleri için z-index ve yatay kaydırma.
 *
 * Kullanım:
 * ```ts
 * const { push, pop, zIndex, contentWrapperStyle } = useDrawerStack('bank-form')
 * ```
 */
export function useDrawerStack(id: string): {
  push: () => void
  pop: () => void
  releaseVisual: () => void
  zIndex: ComputedRef<number>
  stackOffset: ComputedRef<number>
  contentWrapperStyle: ComputedRef<CSSProperties>
} {
  const isMobileViewport = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)

  function push(): void {
    if (stack.value.some((slot) => slot.id === id)) return
    stack.value = [...stack.value, { id }]
    visualBlockIds.value = new Set([...visualBlockIds.value, id])
  }

  function pop(): void {
    stack.value = stack.value.filter((slot) => slot.id !== id)
  }

  function releaseVisual(): void {
    if (!visualBlockIds.value.has(id)) return
    const next = new Set(visualBlockIds.value)
    next.delete(id)
    visualBlockIds.value = next
  }

  const stackIndex = computed<number>(() => stack.value.findIndex((slot) => slot.id === id))

  const zIndex = computed<number>(() => {
    const idx = stackIndex.value
    return BASE_Z_INDEX + (idx < 0 ? 0 : idx + 1) * STEP
  })

  /** Üstteki drawer sayısına göre sola kaydırma (0 = en üst veya tek drawer). */
  const stackOffset = computed<number>(() => {
    const idx = stackIndex.value
    if (idx < 0) return 0
    const depthFromTop = stack.value.length - 1 - idx
    return depthFromTop > 0 ? -depthFromTop * DRAWER_STACK_OFFSET_PX : 0
  })

  const contentWrapperStyle = computed<CSSProperties>(() => {
    if (isMobileViewport.value) return { transition: 'transform 0.2s ease' }
    const offset = stackOffset.value
    if (offset === 0) return { transition: 'transform 0.2s ease' }
    return {
      transform: `translateX(${offset}px)`,
      transition: 'transform 0.2s ease',
    }
  })

  return { push, pop, releaseVisual, zIndex, stackOffset, contentWrapperStyle }
}
