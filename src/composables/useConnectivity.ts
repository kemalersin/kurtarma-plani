import { onMounted, onUnmounted, ref, type Ref } from 'vue'

let listenerCount = 0
const online = ref<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)

function update(): void {
  if (typeof navigator === 'undefined') return
  online.value = navigator.onLine
}

function attach(): void {
  if (listenerCount === 0 && typeof window !== 'undefined') {
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
  }
  listenerCount++
}

function detach(): void {
  listenerCount = Math.max(0, listenerCount - 1)
  if (listenerCount === 0 && typeof window !== 'undefined') {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  }
}

/**
 * Tarayıcı `navigator.onLine` durumunu reaktif olarak izler.
 * `online === false` iken AI ve uzak preset feed çağrıları yapılmamalıdır.
 */
export function useConnectivity(): { online: Ref<boolean> } {
  onMounted(attach)
  onUnmounted(detach)
  return { online }
}
