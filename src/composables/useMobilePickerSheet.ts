import { onBeforeUnmount, ref, watch } from 'vue'
import { registerMobileChildOverlay } from '@/composables/mobileChildOverlay'

/** Mobil tam ekran picker sheet: scroll kilidi + child overlay sayacı. */
export function useMobilePickerSheet() {
  const sheetOpen = ref(false)
  let bodyOverflowBeforeSheet: string | null = null
  let releaseChildOverlay: (() => void) | undefined

  function openSheet(): void {
    sheetOpen.value = true
  }

  function closeSheet(): void {
    sheetOpen.value = false
  }

  function lockBodyScroll(): void {
    if (typeof document === 'undefined') return
    bodyOverflowBeforeSheet = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  function unlockBodyScroll(): void {
    if (typeof document === 'undefined') return
    if (bodyOverflowBeforeSheet != null) {
      document.body.style.overflow = bodyOverflowBeforeSheet
    } else {
      document.body.style.removeProperty('overflow')
    }
    bodyOverflowBeforeSheet = null
  }

  function lockChildOverlay(): void {
    releaseChildOverlay?.()
    releaseChildOverlay = registerMobileChildOverlay()
  }

  function unlockChildOverlay(): void {
    releaseChildOverlay?.()
    releaseChildOverlay = undefined
  }

  watch(sheetOpen, (open) => {
    if (open) {
      lockBodyScroll()
      lockChildOverlay()
    } else {
      unlockChildOverlay()
    }
  })

  function onSheetAfterLeave(): void {
    unlockBodyScroll()
  }

  onBeforeUnmount(() => {
    unlockChildOverlay()
    if (sheetOpen.value) {
      unlockBodyScroll()
    }
  })

  return { sheetOpen, openSheet, closeSheet, onSheetAfterLeave }
}
