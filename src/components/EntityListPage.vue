<script setup lang="ts" generic="T extends { id: string; name?: string; updatedAt: string; archived?: boolean }">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Component,
} from 'vue'
import {
  Badge,
  Button,
  Empty,
  Input,
  Pagination,
  Popconfirm,
  Popover,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import type { TableColumnType, TablePaginationConfig } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import LocaleRangePicker from '@/components/LocaleRangePicker.vue'
import KpTooltip from '@/components/KpTooltip.vue'
import KpColumnTagCell from '@/components/KpColumnTagCell.vue'
import ListCard from '@/components/ListCard.vue'
import ColorSwatch from '@/components/ColorSwatch.vue'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import { formatListCellValue } from '@/core/util/list-cell'
import { useListFilterPopoverProps } from '@/core/ui/list-filter-popover'
import { useClosePopoverOnScroll } from '@/composables/useClosePopoverOnScroll'
import {
  LIST_ACTIONS_COLUMN_WIDTH,
  listColumnScrollWidth,
  prepareListTableColumns,
} from '@/core/util/table-columns'
import { textIncludesSearch } from '@/core/util/search'
import { handleListItemClick } from '@/core/util/list-item-click'
import { useListQuery, type SortOrder } from '@/composables/useListQuery'
import { KP_LIST_MOBILE_MQ, useMatchMedia } from '@/composables/useMatchMedia'
import { useEntitiesStore } from '@/stores/entities'

export interface ListBankOption {
  id: string
  name: string
  archived?: boolean
}

export interface SelectListFilter<T> {
  kind: 'select'
  /** URL query anahtarı (önek `state-key` ile birleştirilir) */
  key: string
  /** Görünen etiket */
  label: string
  placeholder?: string
  options: { value: string; label: string }[]
  /** Kayıttan değer eşleştirmesi; `undefined`/`null` filtre kapsamı dışı */
  getValue: (item: T) => string | undefined | null
}

export interface NumberRangeListFilter<T> {
  kind: 'numberRange'
  key: string
  label: string
  getValue: (item: T) => number | undefined | null
  /** `LocaleInputNumber.kind` — varsayılan `currency` */
  numberKind?: 'currency' | 'integer' | 'percent'
  minPlaceholder?: string
  maxPlaceholder?: string
}

export interface DateRangeListFilter<T> {
  kind: 'dateRange'
  key: string
  label: string
  /** ISO tarih (YYYY-MM-DD veya tam ISO); kıyaslama tarih kısmı (`slice(0, 10)`) üzerinden */
  getValue: (item: T) => string | undefined | null
}

export type ListFilter<T> =
  | SelectListFilter<T>
  | NumberRangeListFilter<T>
  | DateRangeListFilter<T>

interface Props {
  /** Tüm kayıtlar (arşivliler dahil) */
  items: T[]
  loading?: boolean
  columns: TableColumnType<T>[]
  /** Arama kutusu placeholder */
  searchPlaceholder?: string
  /** Arama yapılacak alanlar (string olarak değerlendirilir). Boşsa `name` */
  searchKeys?: (keyof T)[]
  /** Sıfırdan yeni kayıt için buton metni */
  createLabel?: string
  /** Boş durum mesajı */
  emptyText?: string
  /** Arşiv filtresi gösterilsin mi? (varsayılan true) */
  archiveFilter?: boolean
  /** Banka filtresi (built-in). `:banks` ile birlikte kullanılır */
  bankFilter?: boolean
  /** Banka seçenekleri; `bankFilter` true iken zorunlu */
  banks?: ListBankOption[]
  /** Kayıttan banka kimliği (varsayılan: `bankId` alanı) */
  getBankId?: (item: T) => string
  /**
   * Ek filtreler (banka dışındaki tüm filtreler). Popover içinde render edilir.
   * URL state otomatik (useListQuery rawValue/rawPatch).
   */
  filters?: ListFilter<T>[]
  /**
   * URL query anahtarı öneki (`q_<key>`, `bank_<key>`…). Sekmeli/çoklu listeli
   * sayfalarda **zorunlu** — yoksa farklı listeler aynı parametreyi paylaşır.
   */
  stateKey?: string
  /** `@row-click` tanımlıysa işlem sütununda gösterilir */
  rowActionLabel?: string
  rowActionIcon?: Component
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  searchPlaceholder: 'Ara…',
  searchKeys: () => ['name'] as unknown as (keyof T)[],
  createLabel: 'Yeni kayıt',
  emptyText: 'Henüz kayıt yok.',
  archiveFilter: true,
  bankFilter: false,
  banks: () => [],
  filters: () => [] as ListFilter<T>[],
  stateKey: '',
  rowActionLabel: 'Detay',
})

const emit = defineEmits<{
  (e: 'create'): void
  (e: 'edit', item: T): void
  (e: 'delete', item: T): void
  (e: 'row-click', item: T): void
}>()

/**
 * Satır aksiyon butonu (örn. "Taksit planı" / "Hesap özeti").
 * Vue 3.5+ declared emits `useAttrs()` içine düşmediğinden eski
 * `'onRowClick' in attrs` kontrolü kaldırıldı; prop varlığı (label + icon)
 * artık niyeti taşıyan tek sözleşmedir.
 */
const hasRowAction = computed(
  () => !!props.rowActionLabel && !!props.rowActionIcon,
)
const resolvedRowActionIcon = computed(
  () => props.rowActionIcon ?? EyeOutlined,
)

const entitiesStore = useEntitiesStore()

function isRecordSensitive(record: T): boolean {
  return entitiesStore.isSensitiveById(record.id)
}

const isMobile = useMatchMedia(KP_LIST_MOBILE_MQ)

const query = useListQuery({ key: props.stateKey, defaultPageSize: 10 })

const search = query.search
const archiveMode = query.archive
const bankFilterId = query.bank
const sortKey = query.sortKey
const sortOrder = query.sortOrder
const page = query.page
const pageSize = query.size

const filtersOpen = ref(false)
const filterPopoverProps = useListFilterPopoverProps()
const filterTriggerRef = ref<HTMLElement | null>(null)

useClosePopoverOnScroll(filtersOpen, () => filterTriggerRef.value)

/* ---------------------------------------------------------------- bank */

function resolveBankId(item: T): string {
  return props.getBankId?.(item) ?? String((item as { bankId?: string }).bankId ?? '')
}

const bankSelectOptions = computed(() =>
  [...props.banks]
    .filter((b) => !b.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((b) => ({ value: b.id, label: b.name })),
)

function filterSelectOption(input: string, option: unknown): boolean {
  const opt = option as { label?: string }
  return textIncludesSearch(String(opt.label ?? ''), input)
}

const activeBankFilter = computed(() => Boolean(props.bankFilter && bankFilterId.value))

/* -------------------------------------------------------------- custom */

interface NumberRangeState {
  min: number | undefined
  max: number | undefined
}

interface DateRangeState {
  from: string
  to: string
}

function getSelectValue(key: string): string {
  return query.rawValue(key)
}

function setSelectValue(key: string, value: string | undefined): void {
  query.rawPatch({ [key]: value || undefined })
  query.patch({ page: 1 })
}

function getNumberRange(key: string): NumberRangeState {
  const minStr = query.rawValue(`${key}From`)
  const maxStr = query.rawValue(`${key}To`)
  const min = minStr ? Number(minStr) : undefined
  const max = maxStr ? Number(maxStr) : undefined
  return {
    min: Number.isFinite(min) ? (min as number) : undefined,
    max: Number.isFinite(max) ? (max as number) : undefined,
  }
}

function setNumberRange(key: string, side: 'min' | 'max', value: number | null | undefined): void {
  const k = side === 'min' ? `${key}From` : `${key}To`
  query.rawPatch({ [k]: value == null || !Number.isFinite(value) ? undefined : String(value) })
  query.patch({ page: 1 })
}

function getDateRange(key: string): DateRangeState {
  return {
    from: query.rawValue(`${key}From`),
    to: query.rawValue(`${key}To`),
  }
}

function dateRangeValue(key: string): [Dayjs, Dayjs] | null {
  const r = getDateRange(key)
  if (!r.from && !r.to) return null
  const from = dayjs(r.from || r.to)
  const to = dayjs(r.to || r.from)
  return [from, to]
}

function setDateRange(key: string, value: [Dayjs, Dayjs] | null): void {
  if (!value) {
    query.rawPatch({ [`${key}From`]: undefined, [`${key}To`]: undefined })
  } else {
    const [from, to] = value
    query.rawPatch({
      [`${key}From`]: from ? from.format('YYYY-MM-DD') : undefined,
      [`${key}To`]: to ? to.format('YYYY-MM-DD') : undefined,
    })
  }
  query.patch({ page: 1 })
}

function filterActiveFor(f: ListFilter<T>): boolean {
  if (f.kind === 'select') return Boolean(query.rawValue(f.key))
  return Boolean(query.rawValue(`${f.key}From`) || query.rawValue(`${f.key}To`))
}

const extraActiveCount = computed(() => props.filters.filter(filterActiveFor).length)

const activeFilterCount = computed(
  () => (activeBankFilter.value ? 1 : 0) + extraActiveCount.value,
)

const hasAnyFilter = computed(() => props.bankFilter || props.filters.length > 0)

function passesItem(item: T): boolean {
  for (const f of props.filters) {
    if (f.kind === 'select') {
      const v = query.rawValue(f.key)
      if (!v) continue
      const itemValue = f.getValue(item)
      if (itemValue == null || String(itemValue) !== v) return false
    } else if (f.kind === 'numberRange') {
      const { min, max } = getNumberRange(f.key)
      if (min === undefined && max === undefined) continue
      const itemValue = f.getValue(item)
      if (itemValue == null) return false
      if (min !== undefined && itemValue < min) return false
      if (max !== undefined && itemValue > max) return false
    } else {
      const { from, to } = getDateRange(f.key)
      if (!from && !to) continue
      const raw = f.getValue(item)
      if (!raw) return false
      const datePart = raw.slice(0, 10)
      if (from && datePart < from) return false
      if (to && datePart > to) return false
    }
  }
  return true
}

const filtered = computed<T[]>(() => {
  let list = props.items
  if (props.archiveFilter) {
    if (archiveMode.value === 'active') list = list.filter((it) => !it.archived)
    else if (archiveMode.value === 'archived') list = list.filter((it) => it.archived)
  }
  if (activeBankFilter.value) {
    list = list.filter((item) => resolveBankId(item) === bankFilterId.value)
  }
  if (props.filters.length) {
    list = list.filter(passesItem)
  }
  const q = search.value.trim()
  if (q) {
    list = list.filter((item) =>
      props.searchKeys.some((key) => {
        const value = item[key]
        return value != null && textIncludesSearch(String(value), q)
      }),
    )
  }
  return list
})

/* ----------------------------------------------------- controlled sort */

interface EffectiveSort {
  key: string
  order: 'ascend' | 'descend'
}

const effectiveSort = computed<EffectiveSort | null>(() => {
  if (sortKey.value && sortOrder.value) {
    return { key: sortKey.value, order: sortOrder.value }
  }
  for (const col of props.columns) {
    const k = String(col.key ?? col.dataIndex ?? '')
    const def = col.defaultSortOrder as 'ascend' | 'descend' | undefined
    if (k && (def === 'ascend' || def === 'descend')) {
      return { key: k, order: def }
    }
  }
  return null
})

const sortedItems = computed<T[]>(() => {
  const eff = effectiveSort.value
  if (!eff) return filtered.value
  const col = props.columns.find(
    (c) => String(c.key ?? c.dataIndex ?? '') === eff.key,
  )
  const sorter = col?.sorter
  if (typeof sorter !== 'function') return filtered.value
  const list = [...filtered.value]
  const sign = eff.order === 'descend' ? -1 : 1
  list.sort((a, b) => (sorter as (a: T, b: T) => number)(a, b) * sign)
  return list
})

const pagedItems = computed<T[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedItems.value.slice(start, start + pageSize.value)
})

const showEmptyOverlay = computed(
  () => !isMobile.value && !props.loading && filtered.value.length === 0,
)

const showEmptyCards = computed(
  () => isMobile.value && !props.loading && filtered.value.length === 0,
)

/** AntDV varsayılan boş metin (「Veri yok」); gerçek boş durum `kp-list__empty` overlay. */
const tableLocale = { emptyText: ' ' }

/* ----------------------------------------------------------- columns */

/**
 * Mobil kart görünümünde gösterilecek sütunlar.
 * `__` ile başlayan key'ler yalnızca masaüstü tablosunda anlamlıdır; mobilde gizlenir.
 */
const dataColumns = computed(() =>
  prepareListTableColumns(props.columns).filter(
    (c) => !String(c.key ?? '').startsWith('__') && c.key !== 'archived',
  ),
)

const primaryColumn = computed(() => dataColumns.value[0])

const detailColumns = computed(() => dataColumns.value.slice(1))

/**
 * AntDV Table sütunları:
 *  - `prepareListTableColumns`: açık `width` korunur; diğerlerine `minWidth`
 *  - `ellipsis: true` → `{ showTitle: false }` (sütunlarda otomatik tooltip yok)
 *  - aktif `sortOrder` enjekte edilir (controlled sort)
 *  - sonuna `__actions` sütunu eklenir
 */
const allColumns = computed<TableColumnType<T>[]>(() => {
  const eff = effectiveSort.value
  const enhanced = prepareListTableColumns(props.columns).map((col) => {
    const key = String(col.key ?? col.dataIndex ?? '')
    const ellipsis =
      col.ellipsis === true
        ? ({ showTitle: false } as { showTitle: false })
        : col.ellipsis
    const sortOrderForCol = eff && eff.key === key ? eff.order : null
    return {
      ...col,
      ellipsis,
      sortOrder: sortOrderForCol,
    } as TableColumnType<T>
  })
  return [
    ...enhanced,
    {
      key: '__actions',
      title: '',
      align: 'right',
      width: hasRowAction.value ? 132 : LIST_ACTIONS_COLUMN_WIDTH,
    },
  ]
})

/** Sütunların minimum toplam genişliği (px). */
const tableColumnsMinWidth = computed(() =>
  allColumns.value.reduce(
    (sum, col) => sum + listColumnScrollWidth(col as TableColumnType<unknown>),
    0,
  ),
)

/** Tablo sarmalayıcı genişliği — ölçüm sonrası scroll.x kararı için. */
const tableViewportWidth = ref(0)

/**
 * Tablo genişliği: sütun minimumları ile konteyner genişliğinin büyük olanı.
 * Her durumda en az container kadar genişlik; dar ekranda sütun toplamı aşılırsa yatay kaydırma.
 */
const tableScrollX = computed(() => {
  const minW = tableColumnsMinWidth.value
  const vw = tableViewportWidth.value
  return Math.max(minW, vw > 0 ? vw : minW)
})

const tableRowHeight = ref(48)

/**
 * Az satırda gövde en az kalan yüksekliği doldurur (yatay çubuk alanın dibinde).
 * Çok satırda `scroll.y` yok — gövde doğal yüksekliğe büyür, dikey kaydırma `.kp-content` ile.
 */
const tableScrollY = computed(() => {
  if (isMobile.value) return undefined
  const minH = tableBodyMinHeight.value
  if (minH <= 0) return undefined
  const rows = sortedItems.value.length
  if (rows === 0) return minH
  const contentH = rows * tableRowHeight.value
  return contentH < minH ? minH : undefined
})

const tableScroll = computed(() => {
  const s: { x: number; y?: number } = { x: tableScrollX.value }
  const y = tableScrollY.value
  if (y != null) s.y = y
  return s
})

const tableBodyFillsViewport = computed(() => tableScrollY.value != null)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: filtered.value.length,
  showSizeChanger: !isMobile.value,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total) => `${total} kayıt`,
  onChange: (nextPage, nextSize) => {
    query.patch({ page: nextPage, size: nextSize ?? pageSize.value })
  },
}))

/* ---------------------------------------------- table sizing & helpers */

const tableWrapRef = ref<HTMLElement | null>(null)
const cardsWrapRef = ref<HTMLElement | null>(null)
const tableMinHeight = ref(200)
const tableBodyMinHeight = ref(120)
const tableHeadH = ref(40)
const tablePaginationH = ref(56)
let resizeObserver: ResizeObserver | null = null
let contentResizeObserver: ResizeObserver | null = null

const tableWrapStyle = computed(() => ({
  '--kp-table-head-h': `${tableHeadH.value}px`,
  '--kp-table-pagination-h': `${tablePaginationH.value}px`,
  '--kp-table-min-h': `${tableMinHeight.value}px`,
  '--kp-table-body-min-h': `${tableBodyMinHeight.value}px`,
}))

function cellValue(column: TableColumnType<T>, record: T, index: number): string {
  const kpCol = column as TableColumnType<T> & { kpDisplay?: (row: T) => string }
  if (kpCol.kpDisplay) return kpCol.kpDisplay(record)
  return formatListCellValue(column, record as T & Record<string, unknown>, index)
}

function recordColor(record: T): string | undefined {
  const raw = record as Record<string, unknown>
  return typeof raw.color === 'string' ? raw.color : undefined
}

function onMobilePaginationChange(nextPage: number, nextSize?: number): void {
  query.patch({ page: nextPage, size: nextSize ?? pageSize.value })
}

interface TableSorter {
  columnKey?: string | number
  order?: 'ascend' | 'descend' | false | null
}

function onTableChange(
  _pagination: unknown,
  _filters: unknown,
  sorter: TableSorter | TableSorter[],
): void {
  const single = Array.isArray(sorter) ? sorter[0] : sorter
  const order = (single?.order || '') as SortOrder
  const key = single?.columnKey != null ? String(single.columnKey) : ''
  if (!key || !order) {
    query.patch({ sortKey: '', sortOrder: '' })
    return
  }
  query.patch({ sortKey: key, sortOrder: order })
}

function onListItemClick(record: T, event: MouseEvent): void {
  handleListItemClick(record, event, {
    hasRowAction: hasRowAction.value,
    onRowClick: (item) => emit('row-click', item),
    onEdit: (item) => emit('edit', item),
  })
}

function tableCustomRow(record: T): Record<string, unknown> {
  return {
    class: 'kp-list__row--clickable',
    onClick: (event: MouseEvent) => onListItemClick(record, event),
  }
}

function resolveListContentEl(anchor: HTMLElement | null): HTMLElement | null {
  return anchor?.closest('.kp-content') ?? null
}

function measureRemainingHeight(anchor: HTMLElement | null): number {
  const content = resolveListContentEl(anchor)
  if (!content || !anchor) return 200
  const cs = getComputedStyle(content)
  const padBottom = Number.parseFloat(cs.paddingBottom) || 0
  const contentRect = content.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  const topInContent = anchorRect.top - contentRect.top + content.scrollTop
  const available = content.clientHeight - topInContent - padBottom
  return Math.max(160, Math.floor(available))
}

async function measureTableScroll(): Promise<void> {
  await nextTick()
  const anchor = isMobile.value ? cardsWrapRef.value : tableWrapRef.value
  if (!anchor) return
  tableMinHeight.value = measureRemainingHeight(anchor)

  if (!isMobile.value) {
    const wrap = tableWrapRef.value
    if (!wrap) return
    const thead = wrap.querySelector<HTMLElement>('.ant-table-thead')
    const paginationEl = wrap.querySelector<HTMLElement>('.ant-table-pagination')
    tableHeadH.value = thead?.offsetHeight ?? 40
    const paginationOuter = paginationEl
      ? paginationEl.offsetHeight + 16 /* margin-top */
      : 56
    tablePaginationH.value = paginationOuter
    tableViewportWidth.value = wrap.clientWidth
    tableBodyMinHeight.value = Math.max(
      120,
      tableMinHeight.value - tableHeadH.value - tablePaginationH.value,
    )
    const firstRow = wrap.querySelector<HTMLElement>('.ant-table-tbody tr.ant-table-row')
    if (firstRow?.offsetHeight) tableRowHeight.value = firstRow.offsetHeight
    return
  }

  tableBodyMinHeight.value = Math.max(
    120,
    tableMinHeight.value - 56 /* mobil kart sayfalama yaklaşık */,
  )
}

function clearFilters(): void {
  const raw: Record<string, string | undefined> = { bank: undefined, page: undefined }
  for (const f of props.filters) {
    if (f.kind === 'select') raw[f.key] = undefined
    else {
      raw[`${f.key}From`] = undefined
      raw[`${f.key}To`] = undefined
    }
  }
  query.rawPatch(raw)
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    void measureTableScroll()
  })
  if (tableWrapRef.value) resizeObserver.observe(tableWrapRef.value)
  if (cardsWrapRef.value) resizeObserver.observe(cardsWrapRef.value)

  const content = resolveListContentEl(tableWrapRef.value ?? cardsWrapRef.value)
  if (content) {
    contentResizeObserver = new ResizeObserver(() => {
      void measureTableScroll()
    })
    contentResizeObserver.observe(content)
  }

  void measureTableScroll()
  requestAnimationFrame(() => void measureTableScroll())
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  contentResizeObserver?.disconnect()
})

/**
 * Filtre / arama değiştiğinde geçerli sayfa fazla olabilir; 1'e sabitle.
 * (Sayfalama kontrolü zaten URL'de; burada toplam azaldıysa kullanıcıyı boş sayfada bırakmıyoruz.)
 */
watch(
  () => filtered.value.length,
  () => {
    const totalPages = Math.max(1, Math.ceil(filtered.value.length / pageSize.value))
    if (page.value > totalPages) query.patch({ page: 1 })
    void measureTableScroll()
  },
)

watch(() => props.loading, () => void measureTableScroll())
watch(
  () => [sortedItems.value.length, filtered.value.length, isMobile.value] as const,
  () => void measureTableScroll(),
)
</script>

<template>
  <section class="kp-list">
    <div
      class="kp-list__toolbar"
      :class="{ 'kp-list__toolbar--no-archive': !archiveFilter }"
    >
      <Segmented
        v-if="archiveFilter"
        v-model:value="archiveMode"
        class="kp-list__archive"
        :options="[
          { label: 'Aktif', value: 'active' },
          { label: 'Arşivli', value: 'archived' },
          { label: 'Tümü', value: 'all' },
        ]"
      />

      <div ref="filterTriggerRef" class="kp-list__search-group">
        <Input
          v-model:value="search"
          :placeholder="searchPlaceholder"
          allow-clear
          class="kp-list__search"
        >
          <template #prefix><SearchOutlined /></template>
        </Input>

        <Popover
          v-if="hasAnyFilter"
          v-model:open="filtersOpen"
          v-bind="filterPopoverProps"
        >
          <template #content>
            <div class="kp-list-filter">
              <header class="kp-list-filter__head">Filtreler</header>

              <div v-if="bankFilter" class="kp-list-filter__field">
                <label class="kp-list-filter__label">Banka</label>
                <Select
                  :value="bankFilterId || undefined"
                  class="kp-list-filter__control"
                  placeholder="Tüm bankalar"
                  allow-clear
                  show-search
                  :options="bankSelectOptions"
                  :filter-option="filterSelectOption"
                  @update:value="(v: unknown) => { bankFilterId = v == null ? '' : String(v) }"
                />
              </div>

              <div
                v-for="f in filters"
                :key="f.key"
                class="kp-list-filter__field"
              >
                <label class="kp-list-filter__label">{{ f.label }}</label>

                <Select
                  v-if="f.kind === 'select'"
                  :value="getSelectValue(f.key) || undefined"
                  class="kp-list-filter__control"
                  :placeholder="f.placeholder ?? 'Hepsi'"
                  allow-clear
                  show-search
                  :options="f.options"
                  :filter-option="filterSelectOption"
                  @update:value="(v: unknown) => setSelectValue(f.key, v == null ? undefined : String(v))"
                />

                <div v-else-if="f.kind === 'numberRange'" class="kp-list-filter__range">
                  <LocaleInputNumber
                    :value="getNumberRange(f.key).min ?? null"
                    :kind="f.numberKind ?? 'currency'"
                    :placeholder="f.minPlaceholder ?? 'Min'"
                    class="kp-list-filter__range-input"
                    @update:value="(v: number | null | undefined) => setNumberRange(f.key, 'min', v)"
                  />
                  <span class="kp-list-filter__range-sep">–</span>
                  <LocaleInputNumber
                    :value="getNumberRange(f.key).max ?? null"
                    :kind="f.numberKind ?? 'currency'"
                    :placeholder="f.maxPlaceholder ?? 'Maks'"
                    class="kp-list-filter__range-input"
                    @update:value="(v: number | null | undefined) => setNumberRange(f.key, 'max', v)"
                  />
                </div>

                <LocaleRangePicker
                  v-else
                  :value="dateRangeValue(f.key) ?? undefined"
                  class="kp-list-filter__control"
                  allow-clear
                  @update:value="(v: unknown) => setDateRange(f.key, v as [Dayjs, Dayjs] | null)"
                />
              </div>

              <footer class="kp-list-filter__foot">
                <Button
                  block
                  :disabled="activeFilterCount === 0"
                  @click="clearFilters"
                >
                  Filtreyi temizle
                </Button>
              </footer>
            </div>
          </template>
          <Badge
            :count="activeFilterCount"
            :show-zero="false"
            :offset="[-2, 2]"
            size="small"
          >
            <Button
              class="kp-list__filter-trigger"
              :type="activeFilterCount > 0 ? 'primary' : 'default'"
              :ghost="activeFilterCount > 0"
              aria-label="Filtreler"
            >
              <template #icon><FilterOutlined /></template>
            </Button>
          </Badge>
        </Popover>
      </div>

      <Button type="primary" class="kp-list__create" @click="emit('create')">
        <template #icon><PlusOutlined /></template>
        {{ createLabel }}
      </Button>
    </div>

    <!-- Masaüstü: tablo -->
    <div
      ref="tableWrapRef"
      class="kp-list__table kp-list__table--desktop"
      :class="{
        'kp-list__table--empty': showEmptyOverlay,
        'kp-list__table--loading': loading,
        'kp-list__table--fill-body': tableBodyFillsViewport,
      }"
      :style="tableWrapStyle"
    >
      <div v-if="loading" class="kp-list__loading" aria-busy="true" aria-live="polite">
        <Spin size="large" />
      </div>

      <div v-else-if="showEmptyOverlay" class="kp-list__empty" role="status">
        <Empty :description="emptyText" />
      </div>

      <Table
        class="kp-list__table-inner"
        :data-source="sortedItems"
        :columns="allColumns"
        :locale="tableLocale"
        :loading="false"
        :pagination="pagination"
        :row-key="(record: T) => record.id"
        :custom-row="tableCustomRow"
        :show-sorter-tooltip="false"
        size="middle"
        table-layout="fixed"
        :scroll="tableScroll"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === '__actions'">
            <Space class="kp-list__row-actions" :size="4">
              <KpTooltip v-if="hasRowAction" :title="rowActionLabel">
                <Button
                  type="text"
                  size="small"
                  @click.stop="emit('row-click', record as T)"
                >
                  <template #icon>
                    <component :is="resolvedRowActionIcon" />
                  </template>
                </Button>
              </KpTooltip>
              <KpTooltip title="Düzenle">
                <Button
                  type="text"
                  size="small"
                  @click.stop="emit('edit', record as T)"
                >
                  <template #icon><EditOutlined /></template>
                </Button>
              </KpTooltip>
              <Popconfirm
                placement="topRight"
                overlay-class-name="kp-popoverlay-edge"
                title="Bu kayıt silinsin mi?"
                ok-text="Sil"
                cancel-text="Vazgeç"
                :ok-button-props="{ danger: true }"
                @confirm="emit('delete', record as T)"
              >
                <span @click.stop>
                  <KpTooltip title="Sil">
                    <Button type="text" size="small" danger>
                      <template #icon><DeleteOutlined /></template>
                    </Button>
                  </KpTooltip>
                </span>
              </Popconfirm>
            </Space>
          </template>
          <template v-else-if="column.key === 'color'">
            <ColorSwatch :color="recordColor(record as T)" />
          </template>
          <template v-else-if="column.key === 'archived'">
            <Space :size="4" wrap>
              <Tag v-if="isRecordSensitive(record as T)" color="orange">Hassas</Tag>
              <Tag v-if="(record as T).archived" color="default">Arşivli</Tag>
              <Tag v-else color="green">Aktif</Tag>
            </Space>
          </template>
          <template
            v-else-if="primaryColumn && column.key === primaryColumn.key && isRecordSensitive(record as T)"
          >
            <Space :size="6" wrap>
              <span>{{ cellValue(column, record as T, index) }}</span>
              <Tag color="orange">Hassas</Tag>
            </Space>
          </template>
          <template v-else>
            <KpColumnTagCell :column="column" :record="record as T">
              {{ cellValue(column, record as T, index) }}
            </KpColumnTagCell>
          </template>
        </template>
      </Table>
    </div>

    <!-- Mobil: kartlar -->
    <div ref="cardsWrapRef" class="kp-list__cards kp-list__cards--mobile" :style="tableWrapStyle">
      <div v-if="loading" class="kp-list__cards-loading" aria-busy="true" aria-live="polite">
        <Spin size="large" />
      </div>
      <template v-else>
        <div v-if="showEmptyCards" class="kp-list__cards-empty">
          <Empty :description="emptyText" />
        </div>
        <ul v-else class="kp-list__cards-list">
          <ListCard
            v-for="(item, index) in pagedItems"
            :key="item.id"
            @click="onListItemClick(item, $event)"
          >
            <template #title>
              <template v-if="primaryColumn">
                {{ cellValue(primaryColumn, item, index) }}
              </template>
            </template>
            <template #actions>
              <Space :size="4">
                <Tag v-if="isRecordSensitive(item)" color="orange">Hassas</Tag>
                <Tag v-if="item.archived" color="default">Arşivli</Tag>
                <Tag v-else color="green">Aktif</Tag>
                <KpTooltip v-if="hasRowAction" :title="rowActionLabel">
                  <Button type="text" size="small" @click="emit('row-click', item)">
                    <template #icon>
                      <component :is="resolvedRowActionIcon" />
                    </template>
                  </Button>
                </KpTooltip>
                <KpTooltip title="Düzenle">
                  <Button type="text" size="small" @click="emit('edit', item)">
                    <template #icon><EditOutlined /></template>
                  </Button>
                </KpTooltip>
                <Popconfirm
                  placement="topRight"
                  overlay-class-name="kp-popoverlay-edge"
                  title="Bu kayıt silinsin mi?"
                  ok-text="Sil"
                  cancel-text="Vazgeç"
                  :ok-button-props="{ danger: true }"
                  @confirm="emit('delete', item)"
                >
                  <span @click.stop>
                    <KpTooltip title="Sil">
                      <Button type="text" size="small" danger>
                        <template #icon><DeleteOutlined /></template>
                      </Button>
                    </KpTooltip>
                  </span>
                </Popconfirm>
              </Space>
            </template>
            <dl v-if="detailColumns.length" class="kp-list-card__fields">
              <div
                v-for="col in detailColumns"
                :key="String(col.key ?? col.dataIndex)"
                class="kp-list-card__field"
              >
                <dt>{{ col.title }}</dt>
                <dd v-if="col.key === 'color'">
                  <ColorSwatch :color="recordColor(item)" />
                </dd>
                <dd v-else>
                  <KpColumnTagCell :column="col" :record="item">
                    {{ cellValue(col, item, index) }}
                  </KpColumnTagCell>
                </dd>
              </div>
            </dl>
          </ListCard>
        </ul>
        <Pagination
          v-if="filtered.length > 0"
          class="kp-list__cards-pagination"
          :current="page"
          :page-size="pageSize"
          :total="filtered.length"
          :show-size-changer="false"
          :show-total="(total: number) => `${total} kayıt`"
          size="small"
          @change="onMobilePaginationChange"
        />
      </template>
    </div>
  </section>
</template>

<style scoped>
.kp-list {
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-height: 0;
  width: 100%;
}

/** Masaüstü: arama+filtre (sol) · arşiv (orta) · yeni kayıt (sağ) — absolute yok, çakışma olmaz */
.kp-list__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.kp-list__toolbar--no-archive {
  grid-template-columns: minmax(0, 1fr) auto;
}

.kp-list__search-group {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.kp-list__search {
  flex: 0 1 320px;
  width: 100%;
  max-width: 320px;
  min-width: 0;
}

.kp-list__filter-trigger {
  flex-shrink: 0;
}

.kp-list__archive {
  grid-column: 2;
  grid-row: 1;
  justify-self: center;
  max-width: 100%;
}

.kp-list__create {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  flex-shrink: 0;
  white-space: nowrap;
}

.kp-list__toolbar--no-archive .kp-list__create {
  grid-column: 2;
}

.kp-list__table--desktop {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-height: var(--kp-table-min-h, 160px);
}

.kp-list__table-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.kp-list__cards--mobile {
  display: none;
}

.kp-list__table--desktop :deep(.ant-table-wrapper),
.kp-list__table--desktop :deep(.ant-spin-nested-loading),
.kp-list__table--desktop :deep(.ant-spin-container),
.kp-list__table--desktop :deep(.ant-table),
.kp-list__table--desktop :deep(.ant-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-list__table--desktop :deep(.ant-table-header) {
  flex-shrink: 0;
}

/** Az satır: scroll.y ile gövde yüksekliği sabit; yatay çubuk alanın dibinde */
.kp-list__table--fill-body :deep(.ant-table-body) {
  flex: 1 1 0;
  height: 0;
  min-height: var(--kp-table-body-min-h, 120px);
  overflow-x: auto !important;
  overflow-y: hidden !important;
}

/** Çok satır: dahili dikey scroll yok; gövde içerikle büyür, sayfa kayar */
.kp-list__table--desktop:not(.kp-list__table--fill-body) :deep(.ant-table-body) {
  flex: 1 1 auto;
  min-height: var(--kp-table-body-min-h, 120px);
  overflow-x: auto !important;
  overflow-y: visible !important;
}

/** Başlık ve gövde aynı genişlikte kalsın. */
.kp-list__table--desktop :deep(.ant-table-header),
.kp-list__table--desktop :deep(.ant-table-body) {
  width: 100% !important;
}

/**
 * AntDV dikey scrollbar hizası için eklediği boş sütun — gereksiz sağ boşluk bırakır.
 * Gövde `overflow: auto` ile kendi scrollbar'ını yönetir.
 */
.kp-list__table--desktop :deep(.ant-table-cell-scrollbar),
.kp-list__table--desktop :deep(col.ant-table-cell-scrollbar) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  padding: 0 !important;
  border: none !important;
}

.kp-list__table--desktop :deep(.ant-table-pagination) {
  flex-shrink: 0;
  margin: 16px 0 0;
}

.kp-list__table--desktop :deep(tr.kp-list__row--clickable) {
  cursor: pointer;
}

.kp-list__table--desktop :deep(tr.kp-list__row--clickable:hover > td) {
  background: rgba(22, 119, 255, 0.04);
}

[data-theme='dark'] .kp-list__table--desktop :deep(tr.kp-list__row--clickable:hover > td) {
  background: rgba(22, 119, 255, 0.1);
}

.kp-list__empty {
  position: absolute;
  top: var(--kp-table-head-h, 40px);
  right: 0;
  bottom: var(--kp-table-pagination-h, 56px);
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.kp-list__loading {
  position: absolute;
  top: 0;
  right: 0;
  bottom: var(--kp-table-pagination-h, 56px);
  left: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.kp-list__table--empty :deep(tr.ant-table-placeholder),
.kp-list__table--loading :deep(tr.ant-table-placeholder),
.kp-list__table--loading :deep(.ant-table-placeholder .ant-empty) {
  display: none;
}

/* Mobil: arşiv üstte ortada → arama+filtre → yeni kayıt; kart listesi */
@media (max-width: 640px) {
  .kp-list__toolbar {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas:
      'archive'
      'search'
      'create';
  }

  .kp-list__toolbar--no-archive {
    grid-template-areas:
      'search'
      'create';
  }

  .kp-list__archive {
    grid-area: archive;
    grid-column: auto;
    grid-row: auto;
    justify-self: center;
    width: fit-content;
    max-width: 100%;
  }

  .kp-list__search-group {
    grid-area: search;
    grid-column: auto;
    grid-row: auto;
    justify-self: stretch;
    width: 100%;
  }

  .kp-list__search {
    flex: 1;
    max-width: none;
    min-width: 0;
  }

  .kp-list__create {
    grid-area: create;
    grid-column: auto;
    grid-row: auto;
    justify-self: stretch;
  }

  .kp-list__table--desktop {
    display: none;
  }

  .kp-list__cards--mobile {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: var(--kp-table-min-h, 160px);
  }

  .kp-list__cards-list {
    flex: 1;
    min-height: var(--kp-table-body-min-h, 120px);
    overflow: auto;
  }

  .kp-list__cards-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 160px;
  }

  .kp-list__cards-pagination {
    flex-shrink: 0;
    margin-top: 12px;
    text-align: center;
  }
}
</style>
