const TR_LOCALE = 'tr-TR'

/** Liste araması için metin normalizasyonu (Türkçe büyük/küçük harf). */
export function normalizeSearchTextTr(value: string): string {
  return value.trim().toLocaleLowerCase(TR_LOCALE)
}

/** ASCII/Latin alanlar (IBAN, BIC vb.) için ek normalizasyon. */
export function normalizeSearchTextAscii(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Büyük/küçük harf duyarsız alt dizi araması.
 * Önce tr-TR (İ/ı, Ş/ş …); eşleşmezse Latin toLowerCase (IBAN, BIC gibi alanlar).
 */
export function textIncludesSearch(haystack: string, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  const h = String(haystack)
  if (normalizeSearchTextTr(h).includes(normalizeSearchTextTr(q))) return true
  return normalizeSearchTextAscii(h).includes(normalizeSearchTextAscii(q))
}
