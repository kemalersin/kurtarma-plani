export function isInteractiveListClick(target: HTMLElement): boolean {
  return Boolean(
    target.closest('button') ||
      target.closest('a') ||
      target.closest('.ant-popconfirm') ||
      target.closest('.ant-popover') ||
      target.closest('.kp-list__row-actions') ||
      target.closest('.kp-list-card__actions'),
  )
}

export interface ListItemClickHandlers<T> {
  hasRowAction?: boolean
  onRowClick?: (record: T) => void
  onEdit?: (record: T) => void
}

export function handleListItemClick<T>(
  record: T,
  event: MouseEvent,
  handlers: ListItemClickHandlers<T>,
): void {
  if (isInteractiveListClick(event.target as HTMLElement)) return
  if (handlers.hasRowAction && handlers.onRowClick) {
    handlers.onRowClick(record)
  } else if (handlers.onEdit) {
    handlers.onEdit(record)
  }
}

/** `customRow` / drawer tablolarında satır tıklama var mı? */
export function resolveCustomRowClick<T>(
  record: T,
  customRow?: (record: T) => Record<string, unknown>,
): (() => void) | null {
  if (!customRow) return null
  const onClick = customRow(record).onClick
  return typeof onClick === 'function' ? (onClick as () => void) : null
}

export function handleDrawerListItemClick<T>(
  record: T,
  event: MouseEvent,
  options: {
    customRow?: (record: T) => Record<string, unknown>
    onEdit?: (record: T) => void
  },
): void {
  if (isInteractiveListClick(event.target as HTMLElement)) return
  const customClick = resolveCustomRowClick(record, options.customRow)
  if (customClick) {
    customClick()
    return
  }
  options.onEdit?.(record)
}
