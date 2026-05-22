import type { TableColumnType } from 'ant-design-vue'

/** Kart ve tablo dışı özetlerde hücre metnini üretir. */
export function formatListCellValue<T extends Record<string, unknown>>(
  column: TableColumnType<T>,
  record: T,
  index = 0,
): string {
  const key = String(column.key ?? column.dataIndex ?? '')
  if (key === '__actions') return ''
  if (key === 'archived') {
    return record.archived ? 'Arşivli' : 'Aktif'
  }
  if (key === 'color') {
    return record.color ? String(record.color) : '—'
  }
  if (column.customRender) {
    const text = column.dataIndex
      ? record[column.dataIndex as keyof T]
      : undefined
    const rendered = column.customRender({
      record,
      column,
      text,
      index,
    } as Parameters<NonNullable<TableColumnType<T>['customRender']>>[0])
    if (rendered == null) return '—'
    if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered)
  }
  if (column.dataIndex != null) {
    const val = record[column.dataIndex as keyof T]
    if (val != null && val !== '') return String(val)
  }
  return '—'
}
