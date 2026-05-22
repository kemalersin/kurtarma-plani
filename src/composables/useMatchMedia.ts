import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/** AppShell, drawer, tooltip ile aynı kırılım (768px). */
export const KP_MOBILE_VIEWPORT_MQ = '(max-width: 768px)'

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
