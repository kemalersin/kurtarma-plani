import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker yeni sürümü hazırladığında `true` olur.
 * UI tarafı (`UpdateAvailableNotice`) bu sinyali gözleyip kullanıcıyı
 * yenileme akışına yönlendirir.
 */
export const swNeedsRefresh = ref(false)

/** Service worker offline kullanıma hazır olduğunda `true` olur. */
export const swOfflineReady = ref(false)

let updateSW: ((reload?: boolean) => Promise<void>) | undefined

/**
 * Yalnızca HTTP(S) üzerinden açılan dağıtımda service worker kaydolur
 * (örn. https://kurtar.co). `file://` veya geliştirme dışı protokollerde
 * kayıt yapılmaz.
 */
export function registerPwa(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (!window.location.protocol.startsWith('http')) return

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      swNeedsRefresh.value = true
    },
    onOfflineReady() {
      swOfflineReady.value = true
    },
  })
}

/** Bekleyen service worker'ı aktive edip sayfayı yeniden yükler. */
export async function applyPwaUpdate(): Promise<void> {
  if (!updateSW) {
    if (typeof window !== 'undefined') window.location.reload()
    return
  }
  await updateSW(true)
}
