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
}

export function resolveKpColumnTag<T>(
  column: TableColumnType<T>,
  record: T,
): KpColumnTag | null {
  const tag = (column as KpTableColumn<T>).kpTag?.(record)
  if (!tag?.label) return null
  return tag
}

/** Genişlik verilmemiş liste sütunları için taban minimum (px). */
export const LIST_COLUMN_DEFAULT_MIN_WIDTH = 112

/** `__actions` sütunu */
export const LIST_ACTIONS_COLUMN_WIDTH = 88

function parsePx(value: number | string | undefined): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Liste tablosu sütunlarını yatay kaydırma için hazırlar.
 * - Açık `width` korunur (örn. birincil ad 280px).
 * - `width` yoksa `minWidth` atanır — sütunlar %100'e sıkıştırılmaz.
 * - `fixed` / `maxWidth` kaldırılır.
 */
export function prepareListTableColumns<T>(
  columns: TableColumnType<T>[],
): TableColumnType<T>[] {
  return columns.map((col) => {
    const { fixed: _fixed, maxWidth: _max, ...rest } = col
    const width = parsePx(col.width as number | string | undefined)
    if (width != null) {
      return { ...rest, width } as TableColumnType<T>
    }
    const minWidth =
      parsePx(col.minWidth as number | string | undefined) ?? LIST_COLUMN_DEFAULT_MIN_WIDTH
    return { ...rest, minWidth } as TableColumnType<T>
  })
}

/** Sütunun `scroll.x` toplamına katkısı (px). */
export function listColumnScrollWidth(col: TableColumnType<unknown>): number {
  const width = parsePx(col.width as number | string | undefined)
  if (width != null) return width
  const minWidth = parsePx(col.minWidth as number | string | undefined)
  return minWidth ?? LIST_COLUMN_DEFAULT_MIN_WIDTH
}

/**
 * @deprecated `prepareListTableColumns` kullanın.
 */
export function stripColumnWidths<T>(columns: TableColumnType<T>[]): TableColumnType<T>[] {
  return prepareListTableColumns(columns)
}
