import type { TableColumnType } from 'ant-design-vue'
import type { VNode } from 'vue'

export type ListCellContent =
  | { kind: 'text'; text: string }
  | { kind: 'vnode'; vnode: VNode }
  | { kind: 'empty' }

type CustomRenderArgs<T> = Parameters<
  NonNullable<TableColumnType<T>['customRender']>
>[0]

function invokeCustomRender<T extends Record<string, unknown>>(
  column: TableColumnType<T>,
  record: T,
  index: number,
) {
  const text = column.dataIndex ? record[column.dataIndex as keyof T] : undefined
  return column.customRender!({
    record,
    column,
    text,
    index,
  } as CustomRenderArgs<T>)
}

/** Tablo hücresi içeriği — metin, VNode veya boş. */
export function resolveListCellContent<T extends Record<string, unknown>>(
  column: TableColumnType<T>,
  record: T,
  index = 0,
): ListCellContent {
  const key = String(column.key ?? column.dataIndex ?? '')
  if (key === '__actions') return { kind: 'empty' }
  if (key === 'archived') {
    return { kind: 'text', text: record.archived ? 'Arşivli' : 'Aktif' }
  }
  if (key === 'color') {
    return { kind: 'text', text: record.color ? String(record.color) : '—' }
  }
  if (column.customRender) {
    const rendered = invokeCustomRender(column, record, index)
    if (rendered == null) {
      return key.startsWith('__') ? { kind: 'empty' } : { kind: 'text', text: '—' }
    }
    if (typeof rendered === 'string' || typeof rendered === 'number') {
      return { kind: 'text', text: String(rendered) }
    }
    return { kind: 'vnode', vnode: rendered as VNode }
  }
  if (column.dataIndex != null) {
    const val = record[column.dataIndex as keyof T]
    if (val != null && val !== '') return { kind: 'text', text: String(val) }
  }
  return { kind: 'text', text: '—' }
}

/** Kart ve tablo dışı özetlerde hücre metnini üretir. */
export function formatListCellValue<T extends Record<string, unknown>>(
  column: TableColumnType<T>,
  record: T,
  index = 0,
): string {
  const content = resolveListCellContent(column, record, index)
  if (content.kind === 'text') return content.text
  return ''
}
