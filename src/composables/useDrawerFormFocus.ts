import { KP_MOBILE_VIEWPORT_MQ } from '@/composables/useMatchMedia'

/** FormDrawer içinde kaydırılabilir alanlar (gövde + drawer içi tablo). */
export const FORM_DRAWER_SCROLL_SELECTOR =
  '.ant-drawer-body, .kp-form-drawer__body, .kp-drawer-table .ant-table-body'

/** FormDrawer kaydırma alanlarını üste alır (tercihen kapanışta, açılış öncesi). */
export function resetFormDrawerScroll(root: Element | null | undefined): void {
  if (!root) return
  const drawerEl = root.closest<HTMLElement>('.kp-form-drawer')
  const nodes = drawerEl
    ? Array.from(drawerEl.querySelectorAll<HTMLElement>(FORM_DRAWER_SCROLL_SELECTOR))
    : root instanceof HTMLElement
      ? [root]
      : []
  for (const el of nodes) {
    el.scrollTop = 0
    el.scrollLeft = 0
  }
}

const FOCUSABLE_SELECTOR = [
  'input.ant-input:not([disabled]):not([type="hidden"])',
  'textarea.ant-input:not([disabled])',
  'input.ant-select-selection-search-input:not([disabled])',
  '.ant-input-number-input:not([disabled])',
  '.ant-picker-input input:not([disabled])',
].join(', ')

/** Drawer açıldığında formdaki ilk odaklanabilir alana odaklanır (mobilde klavye açılmasın diye atlanır). */
export function focusFirstFormField(root: Element | null | undefined): void {
  if (!root) return
  if (typeof window !== 'undefined' && window.matchMedia(KP_MOBILE_VIEWPORT_MQ).matches) return
  const el = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  if (!el) return
  el.focus({ preventScroll: true })
}
