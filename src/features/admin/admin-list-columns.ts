import type { TableColumnType } from 'ant-design-vue'
import { compareByDisplayLabel } from '@/core/util/list-sorters'

/** Yönetim listelerinde birincil ad sütunu (Banka Ad, Hesap, Kasa, Gelir/Gider türü Ad). */
export const ADMIN_PRIMARY_NAME_COLUMN_WIDTH = 280

export function adminPrimaryNameColumn<T extends { name: string }>(
  title: string,
): TableColumnType<T> {
  return {
    key: 'name',
    title,
    dataIndex: 'name',
    width: ADMIN_PRIMARY_NAME_COLUMN_WIDTH,
    /** `showTitle: false` → ellipsis hover tooltip'i devre dışı (ui-patterns: liste sütunlarında tooltip yok). */
    ellipsis: { showTitle: false },
    sorter: (a, b) => compareByDisplayLabel(a, b, (row) => row.name),
    defaultSortOrder: 'ascend',
  }
}

/** Gelir/gider türü listeleri */
export function parametricTypeNameColumn<T extends { name: string }>(): TableColumnType<T> {
  return adminPrimaryNameColumn<T>('Ad')
}
