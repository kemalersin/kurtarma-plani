/** Görünen metne göre sıralama (Türkçe locale). */
export function compareByDisplayLabel<T>(
  a: T,
  b: T,
  labelOf: (item: T) => string,
): number {
  return labelOf(a).localeCompare(labelOf(b), 'tr')
}

/** Sayısal alan veya türetilmiş metrik sıralaması. */
export function compareNumeric<T>(a: T, b: T, valueOf: (item: T) => number): number {
  return valueOf(a) - valueOf(b)
}

/** ISO tarih; boş değerler sonda. */
export function compareIsoDate(a?: string | null, b?: string | null): number {
  const ad = a ?? ''
  const bd = b ?? ''
  if (!ad && !bd) return 0
  if (!ad) return 1
  if (!bd) return -1
  return ad.localeCompare(bd)
}

/** Renk (#RRGGBB); boş sonda. */
export function compareOptionalString(a?: string | null, b?: string | null): number {
  const av = a ?? ''
  const bv = b ?? ''
  if (!av && !bv) return 0
  if (!av) return 1
  if (!bv) return -1
  return av.localeCompare(bv, 'tr')
}
/** `paidCount / totalCount` ilerleme sütunu. */
export function compareProgressCounts(
  a: { paidCount: number; totalCount: number },
  b: { paidCount: number; totalCount: number },
): number {
  if (a.paidCount !== b.paidCount) return a.paidCount - b.paidCount
  return a.totalCount - b.totalCount
}
