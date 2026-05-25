import { onScopeDispose, watch, type Ref } from 'vue'

function resolveScrollRoot(anchor: HTMLElement | null): HTMLElement | null {
  return anchor?.closest('.kp-content') ?? document.querySelector<HTMLElement>('.kp-content')
}

/**
 * Açık popover, AppShell `.kp-content` (ve içindeki kaydırılabilir alanlar) kaydırılınca kapanır.
 */
export function useClosePopoverOnScroll(
  open: Ref<boolean>,
  getAnchor: () => HTMLElement | null,
): void {
  let scrollRoot: HTMLElement | null = null

  function onScroll(): void {
    if (open.value) open.value = false
  }

  function bind(): void {
    unbind()
    scrollRoot = resolveScrollRoot(getAnchor())
    scrollRoot?.addEventListener('scroll', onScroll, { capture: true, passive: true })
  }

  function unbind(): void {
    scrollRoot?.removeEventListener('scroll', onScroll, { capture: true })
    scrollRoot = null
  }

  watch(open, (isOpen) => {
    if (isOpen) bind()
    else unbind()
  })

  onScopeDispose(unbind)
}
