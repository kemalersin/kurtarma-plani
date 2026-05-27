const VV_HEIGHT_VAR = '--kp-vv-height'
const VV_OFFSET_TOP_VAR = '--kp-vv-offset-top'

let bindCount = 0
let listening = false

function syncVisualViewportCssVars(): void {
  if (typeof document === 'undefined') return
  const vv = window.visualViewport
  const root = document.documentElement
  if (!vv) {
    root.style.removeProperty(VV_HEIGHT_VAR)
    root.style.removeProperty(VV_OFFSET_TOP_VAR)
    return
  }
  root.style.setProperty(VV_HEIGHT_VAR, `${vv.height}px`)
  root.style.setProperty(VV_OFFSET_TOP_VAR, `${vv.offsetTop}px`)
}

function clearVisualViewportCssVars(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty(VV_HEIGHT_VAR)
  root.style.removeProperty(VV_OFFSET_TOP_VAR)
}

function onVisualViewportChange(): void {
  syncVisualViewportCssVars()
}

function attachVisualViewportListeners(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.visualViewport?.addEventListener('resize', onVisualViewportChange)
  window.visualViewport?.addEventListener('scroll', onVisualViewportChange)
  window.addEventListener('resize', onVisualViewportChange)
  syncVisualViewportCssVars()
}

function detachVisualViewportListeners(): void {
  if (!listening || typeof window === 'undefined') return
  listening = false
  window.visualViewport?.removeEventListener('resize', onVisualViewportChange)
  window.visualViewport?.removeEventListener('scroll', onVisualViewportChange)
  window.removeEventListener('resize', onVisualViewportChange)
  clearVisualViewportCssVars()
}

/**
 * Mobil klavye açıldığında `visualViewport` ölçülerini kök CSS değişkenlerine yazar.
 * Referans sayacı — birden fazla drawer açıkken son kapanışta temizlenir.
 */
export function bindVisualViewportCssVars(): () => void {
  bindCount += 1
  if (bindCount === 1) attachVisualViewportListeners()
  return () => {
    bindCount = Math.max(0, bindCount - 1)
    if (bindCount === 0) detachVisualViewportListeners()
  }
}

/** Test / SSR */
export function __resetVisualViewportCssVarsForTests(): void {
  bindCount = 0
  detachVisualViewportListeners()
}
