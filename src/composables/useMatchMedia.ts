import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/** AppShell, drawer, tooltip ile aynı kırılım (768px). */
export const KP_MOBILE_VIEWPORT_MQ = '(max-width: 768px)'

/** Ant Design `md` — 768px ve üzeri. */
export const KP_MD_VIEWPORT_MIN_MQ = '(min-width: 768px)'

/** EntityListPage / DrawerDataTable: tablo ↔ kart kırılımı (640px). */
export const KP_LIST_MOBILE_MQ = '(max-width: 640px)'

/** Ant Design `lg` — grid ve panel kırılımı (992px). */
export const KP_LG_UP_MQ = '(min-width: 992px)'

/** Hover ile peek; dokunmatik birincil cihazlarda false. */
export const KP_HOVER_CAPABLE_MQ = '(hover: hover) and (pointer: fine)'

export function useMatchMedia(query: string): Ref<boolean> {
  const matches = ref(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  let mq: MediaQueryList | null = null

  function sync(): void {
    matches.value = mq?.matches ?? false
  }

  onMounted(() => {
    mq = window.matchMedia(query)
    sync()
    mq.addEventListener('change', sync)
  })

  onUnmounted(() => {
    mq?.removeEventListener('change', sync)
  })

  return matches
}

/** AppShell, drawer, tooltip ile aynı kırılım (768px). */
export function useMobileViewport(): Ref<boolean> {
  return useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
}

/** Hover ile peek; dokunmatik birincil cihazlarda false. */
export function useHoverCapable(): Ref<boolean> {
  return useMatchMedia(KP_HOVER_CAPABLE_MQ)
}
