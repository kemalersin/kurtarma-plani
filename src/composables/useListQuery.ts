import { computed, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type ArchiveMode = 'active' | 'archived' | 'all'
export type SortOrder = 'ascend' | 'descend' | ''

export interface ListQueryState {
  /** Arama metni (kayıt alanlarında alt dizi araması) */
  search: WritableComputedRef<string>
  /** Arşiv segmenti — varsayılan `active` */
  archive: WritableComputedRef<ArchiveMode>
  /** Banka filtresi — boş string filtre yok */
  bank: WritableComputedRef<string>
  /** Sıralama sütun anahtarı */
  sortKey: WritableComputedRef<string>
  /** Sıralama yönü */
  sortOrder: WritableComputedRef<SortOrder>
  /** Geçerli sayfa (1 tabanlı) */
  page: WritableComputedRef<number>
  /** Sayfa boyutu */
  size: WritableComputedRef<number>
  /** Birden fazla parametreyi tek `router.replace` ile günceller. */
  patch(patch: Partial<RawListQueryPatch>): void
  /** Belirtilen anahtarlarla başka alanlar okumak için (örn. `status_loans`). */
  rawValue(name: string): string
  /** Belirtilen anahtara raw değer yazar (boş/`undefined` → kaldır). */
  rawPatch(patch: Record<string, string | undefined>): void
}

export interface RawListQueryPatch {
  search?: string
  archive?: ArchiveMode
  bank?: string
  sortKey?: string
  sortOrder?: SortOrder
  page?: number
  size?: number
}

export interface UseListQueryOptions {
  /** URL query anahtarı öneki (örn. `loans` → `q_loans`). Sekme paylaşan listeler için zorunlu. */
  key?: string
  /** Sayfa boyutu varsayılanı (URL'de yazılmaz) */
  defaultPageSize?: number
}

function readStr(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
}

const PARAM_NAMES = {
  search: 'q',
  archive: 'archived',
  bank: 'bank',
  sortKey: 'sort',
  sortOrder: 'order',
  page: 'page',
  size: 'size',
} as const

/**
 * Liste sayfası için arama, arşiv, banka, sıralama, sayfa ve sayfa boyutu
 * durumunu URL query parametreleri ile iki yönlü senkronlar.
 *
 * Tüm anahtarlar `key` öneki ile prefiks'lenir (`q_<key>`, `bank_<key>`…).
 * Varsayılan değerler URL'e yazılmaz (temiz URL).
 */
export function useListQuery(options: UseListQueryOptions = {}): ListQueryState {
  const { key = '', defaultPageSize = 10 } = options
  const prefix = key ? `_${key}` : ''
  const route = useRoute()
  const router = useRouter()

  function fullKey(name: string): string {
    return `${name}${prefix}`
  }

  function rawValue(name: string): string {
    return readStr(route.query[fullKey(name)])
  }

  function rawPatch(patch: Record<string, string | undefined>): void {
    const query = { ...route.query }
    let changed = false
    for (const [k, v] of Object.entries(patch)) {
      const full = fullKey(k)
      const current = readStr(query[full])
      const next = v == null || v === '' ? undefined : v
      if (next === undefined && current !== '') {
        delete query[full]
        changed = true
      } else if (next !== undefined && current !== next) {
        query[full] = next
        changed = true
      }
    }
    if (!changed) return
    void router.replace({ path: route.path, hash: route.hash, query })
  }

  function patch(p: Partial<RawListQueryPatch>): void {
    const raw: Record<string, string | undefined> = {}
    if (p.search !== undefined) raw[PARAM_NAMES.search] = p.search || undefined
    if (p.archive !== undefined)
      raw[PARAM_NAMES.archive] = p.archive === 'active' ? undefined : p.archive
    if (p.bank !== undefined) raw[PARAM_NAMES.bank] = p.bank || undefined
    if (p.sortKey !== undefined) raw[PARAM_NAMES.sortKey] = p.sortKey || undefined
    if (p.sortOrder !== undefined) raw[PARAM_NAMES.sortOrder] = p.sortOrder || undefined
    if (p.page !== undefined) raw[PARAM_NAMES.page] = p.page > 1 ? String(p.page) : undefined
    if (p.size !== undefined)
      raw[PARAM_NAMES.size] = p.size === defaultPageSize ? undefined : String(p.size)
    rawPatch(raw)
  }

  const search = computed<string>({
    get: () => rawValue(PARAM_NAMES.search),
    set: (value) => patch({ search: value }),
  })

  const archive = computed<ArchiveMode>({
    get: () => {
      const v = rawValue(PARAM_NAMES.archive)
      return v === 'archived' || v === 'all' ? v : 'active'
    },
    set: (value) => patch({ archive: value, page: 1 }),
  })

  const bank = computed<string>({
    get: () => rawValue(PARAM_NAMES.bank),
    /** AntDV Select `allow-clear` → `undefined`; hepsini URL'den kaldır. */
    set: (value) => patch({ bank: value == null || value === '' ? '' : String(value), page: 1 }),
  })

  const sortKey = computed<string>({
    get: () => rawValue(PARAM_NAMES.sortKey),
    set: (value) => patch({ sortKey: value }),
  })

  const sortOrder = computed<SortOrder>({
    get: () => {
      const v = rawValue(PARAM_NAMES.sortOrder)
      return v === 'ascend' || v === 'descend' ? v : ''
    },
    set: (value) => patch({ sortOrder: value }),
  })

  const page = computed<number>({
    get: () => {
      const n = Number(rawValue(PARAM_NAMES.page))
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
    },
    set: (value) => patch({ page: value }),
  })

  const size = computed<number>({
    get: () => {
      const n = Number(rawValue(PARAM_NAMES.size))
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : defaultPageSize
    },
    set: (value) => patch({ size: value }),
  })

  return {
    search,
    archive,
    bank,
    sortKey,
    sortOrder,
    page,
    size,
    patch,
    rawValue,
    rawPatch,
  }
}
