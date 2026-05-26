import type { TableColumnType } from 'ant-design-vue'

/** Sütun hücresinde renkli etiket (tablo + mobil kart). */
export type KpColumnTag = {
  color?: string
  label: string
}

/** Liste / drawer tablo sütunu genişletmeleri. */
export type KpTableColumn<T> = TableColumnType<T> & {
  kpDisplay?: (row: T) => string
  kpTag?: (row: T) => KpColumnTag | null | undefined
  /** Başlık tahmininden büyükse sütun alt genişliği (örn. Tag sütunları). */
  kpMinWidth?: number
}

/** Yatay kaydırma: tablo genişliği içeriğe göre (elle sütun px verilmez). */
export const TABLE_SCROLL_X = 'max-content' as const

/** `__actions`: düzenle + sil */
export const LIST_ACTIONS_COLUMN_WIDTH = 70

/** `__actions`: satır aksiyonu + düzenle + sil */
export const LIST_ACTIONS_COLUMN_WIDTH_WITH_ROW_ACTION = 95

/** İşlem sütunu genişliği (2 veya 3 ikon düğmesi). */
export function listActionsColumnWidth(options?: { rowAction?: boolean }): number {
  return options?.rowAction ? LIST_ACTIONS_COLUMN_WIDTH_WITH_ROW_ACTION : LIST_ACTIONS_COLUMN_WIDTH
}

function implicitColumnMinWidth<T>(col: TableColumnType<T>): number | undefined {
  const kpCol = col as KpTableColumn<T>
  if (kpCol.kpMinWidth != null) return kpCol.kpMinWidth
  const key = String(col.key ?? '')
  if (key === 'archived') return 108
  if (kpCol.kpTag) return 96
  return undefined
}

export function resolveKpColumnTag<T>(
  column: TableColumnType<T>,
  record: T,
): KpColumnTag | null {
  const tag = (column as KpTableColumn<T>).kpTag?.(record)
  if (!tag?.label) return null
  return tag
}

/**
 * Liste tablosu sütunlarını hazırlar.
 * Elle `width` / `maxWidth` / `fixed` kaldırılır; yalnızca `kpMinWidth` (veya `archived` / `kpTag` için varsayılan) kalır.
 */
export function prepareListTableColumns<T>(
  columns: TableColumnType<T>[],
): TableColumnType<T>[] {
  return columns.map((col) => {
    const { width: _w, minWidth: _min, maxWidth: _max, fixed: _fixed, ...rest } = col
    const minWidth = implicitColumnMinWidth(col)
    return (minWidth != null ? { ...rest, minWidth } : rest) as TableColumnType<T>
  })
}

/**
 * @deprecated `prepareListTableColumns` kullanın.
 */
export function stripColumnWidths<T>(columns: TableColumnType<T>[]): TableColumnType<T>[] {
  return prepareListTableColumns(columns)
}
