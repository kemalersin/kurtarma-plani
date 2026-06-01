import { computed, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'

/** Ayarlar sayfası oturumu — TabPane remount olsa da korunur. */
const visitConsumed = ref(false)
const visitArmed = ref(false)

/**
 * «Şimdi senkronize et» için tek seferlik sekme giriş hakkı.
 * Ayarlar sayfasından çıkınca `resetSyncNowVisitGate()` ile sıfırlanır.
 */
export function useSyncNowVisitGate(
  activeTab: MaybeRefOrGetter<string>,
  syncTabKey = 'sync',
) {
  watch(
    () => toValue(activeTab),
    (tab, prev) => {
      if (tab === syncTabKey && prev !== syncTabKey && !visitConsumed.value) {
        visitArmed.value = true
      }
      if (prev === syncTabKey && tab !== syncTabKey) {
        visitArmed.value = false
        visitConsumed.value = true
      }
    },
    { immediate: true },
  )

  const syncNowVisitArmed = computed(() => visitArmed.value)

  function consumeSyncNowVisit(): void {
    visitArmed.value = false
    visitConsumed.value = true
  }

  function resetSyncNowVisitGate(): void {
    visitArmed.value = false
    visitConsumed.value = false
  }

  return { syncNowVisitArmed, consumeSyncNowVisit, resetSyncNowVisitGate }
}
