import type { TablePaginationConfig } from 'ant-design-vue/es/table'
import type { ListQueryState, SortOrder } from '@/composables/useListQuery'

interface TableSorter {
  columnKey?: string | number
  order?: 'ascend' | 'descend' | false | null
}

type TableChangeAction = 'paginate' | 'sort' | 'filter'

export interface ListDefaultSort {
  sortKey: string
  sortOrder: Exclude<SortOrder, ''>
}

export type AntdvSortDirection = 'ascend' | 'descend'

/** AntDV sıralama döngüsü — `defaultSortOrder: 'descend'` sütunlarda tıklama yutulmasın. */
export function resolveListColumnSortDirections(column: {
  sorter?: unknown
  defaultSortOrder?: unknown
}): AntdvSortDirection[] | undefined {
  if (!column.sorter) return undefined
  return column.defaultSortOrder === 'descend'
    ? ['descend', 'ascend']
    : ['ascend', 'descend']
}

function columnSortKey(column: { key?: unknown; dataIndex?: unknown }): string {
  if (column.key != null && column.key !== '') return String(column.key)
  const dataIndex = column.dataIndex
  if (dataIndex == null || dataIndex === '') return ''
  if (Array.isArray(dataIndex)) return dataIndex.map(String).join('.')
  return String(dataIndex)
}

/** Sütun tanımından ilk `defaultSortOrder` değerini çözümler. */
export function resolveDefaultColumnSort(
  columns: ReadonlyArray<{
    key?: unknown
    dataIndex?: unknown
    defaultSortOrder?: unknown
  }>,
): ListDefaultSort | null {
  for (const col of columns) {
    const sortKey = columnSortKey(col)
    const order = col.defaultSortOrder
    if (sortKey && (order === 'ascend' || order === 'descend')) {
      return { sortKey, sortOrder: order }
    }
  }
  return null
}

/** Varsayılan sıralama URL'e yazılmaz — boş patch ile query'den silinir. */
export function normalizeListSortPatch(
  key: string,
  order: SortOrder,
  defaults?: ListDefaultSort | null,
): { sortKey: string; sortOrder: SortOrder } {
  if (!key || !order) return { sortKey: '', sortOrder: '' }
  if (defaults && key === defaults.sortKey && order === defaults.sortOrder) {
    return { sortKey: '', sortOrder: '' }
  }
  return { sortKey: key, sortOrder: order }
}

/** AntDV Table `@change` — sayfalama / sıralama URL query güncellemesi (tek patch). */
export function applyListTableChange(
  query: ListQueryState,
  pageSize: number,
  pagination: TablePaginationConfig,
  sorter: TableSorter | TableSorter[],
  extra?: { action?: TableChangeAction },
  defaultSort?: ListDefaultSort | null,
): void {
  if (extra?.action === 'paginate') {
    query.patch({
      page: pagination.current ?? 1,
      size: pagination.pageSize ?? pageSize,
    })
    return
  }
  if (extra?.action !== 'sort') return

  const single = Array.isArray(sorter) ? sorter[0] : sorter
  const order = (single?.order || '') as SortOrder
  const key = single?.columnKey != null ? String(single.columnKey) : ''
  query.patch(normalizeListSortPatch(key, order, defaultSort))
}

export function listTablePaginationConfig(
  params: Pick<TablePaginationConfig, 'current' | 'pageSize' | 'total'> &
    Partial<TablePaginationConfig>,
): TablePaginationConfig {
  const { current, pageSize, total, ...rest } = params
  return {
    current,
    pageSize,
    total,
    showSizeChanger: true,
    ...rest,
  }
}
