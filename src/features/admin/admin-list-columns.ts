import type { TableColumnType } from 'ant-design-vue'
import { compareByDisplayLabel } from '@/core/util/list-sorters'
import type { KpTableColumn } from '@/core/util/table-columns'

export function adminPrimaryNameColumn<T extends { name: string }>(
  title: string,
): KpTableColumn<T> {
  return {
    key: 'name',
    title,
    dataIndex: 'name',
    kpMinWidth: 160,
    /** `showTitle: false` → ellipsis hover tooltip'i devre dışı (ui-patterns: liste sütunlarında tooltip yok). */
    ellipsis: { showTitle: false },
    sorter: (a, b) => compareByDisplayLabel(a, b, (row) => row.name),
    defaultSortOrder: 'ascend',
  } satisfies KpTableColumn<T>
}

/** Gelir/gider türü listeleri */
export function parametricTypeNameColumn<T extends { name: string }>(): TableColumnType<T> {
  return adminPrimaryNameColumn<T>('Ad')
}
