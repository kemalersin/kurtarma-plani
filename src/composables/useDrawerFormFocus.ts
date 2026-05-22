const FOCUSABLE_SELECTOR = [
  'input.ant-input:not([disabled]):not([type="hidden"])',
  'textarea.ant-input:not([disabled])',
  'input.ant-select-selection-search-input:not([disabled])',
  '.ant-input-number-input:not([disabled])',
  '.ant-picker-input input:not([disabled])',
].join(', ')

/** Drawer açıldığında formdaki ilk odaklanabilir alana odaklanır. */
export function focusFirstFormField(root: Element | null | undefined): void {
  if (!root) return
  const el = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  if (!el) return
  el.focus({ preventScroll: true })
}
