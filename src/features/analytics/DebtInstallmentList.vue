<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Badge,
  Button,
  Input,
  Table,
  Tag,
} from 'ant-design-vue'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { ColumnsType, TablePaginationConfig } from 'ant-design-vue/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import LocaleRangePicker from '@/components/LocaleRangePicker.vue'
import KpSelect from '@/components/KpSelect.vue'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import KpListFilterOverlay from '@/components/KpListFilterOverlay.vue'
import { textIncludesSearch } from '@/core/util/search'
import { prepareListTableColumns, TABLE_SCROLL_X } from '@/core/util/table-columns'
import { useListFilterPopoverProps } from '@/core/ui/list-filter-popover'
import { useClosePopoverOnScroll } from '@/composables/useClosePopoverOnScroll'
import { useListQuery } from '@/composables/useListQuery'
import {
  applyListTableChange,
  listTablePaginationConfig,
} from '@/composables/useListTableChange'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { ListFilter } from '@/components/EntityListPage.vue'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import {
  debtInstallmentTypeLabel,
  debtInstallmentPaidDisplay,
  debtInstallmentStatusDisplay,
  debtInstallmentTableAmount,
  type DebtInstallmentRow,
} from '@/features/analytics/reports'
import {
  analyticsRangeQueryActive,
  clearAnalyticsListRouteQuery,
} from '@/features/analytics/analyticsListQueryClear'
import {
  DEBT_INSTALLMENT_LIST_FILTERS,
  filterDebtInstallmentRows,
} from '@/features/analytics/debtInstallmentListFilters'

const props = defineProps<{
  rows: DebtInstallmentRow[]
  currency: string
  filters: AnalyticsFilterState
  banks: { id: string; name: string }[]
}>()

const { formatCurrency, formatDate } = useLocaleFormatters()
const route = useRoute()
const router = useRouter()
const query = useListQuery({
  key: 'debtInstallments',
  defaultPageSize: 15,
  resolveDefaultSort: () => ({ sortKey: 'dueDate', sortOrder: 'ascend' }),
})

const search = query.search
const page = query.page
const pageSize = query.size
const sortKey = query.sortKey
const sortOrder = query.sortOrder

const filtersOpen = ref(false)
const filterPopoverProps = useListFilterPopoverProps()
const filterTriggerRef = ref<HTMLElement | null>(null)

useClosePopoverOnScroll(filtersOpen, () => filterTriggerRef.value)

const analyticsRangeValue = computed<[Dayjs, Dayjs]>(() => [
  dayjs(props.filters.range.value.from),
  dayjs(props.filters.range.value.to),
])

function onAnalyticsRangeChange(dates: [Dayjs, Dayjs] | null): void {
  if (!dates?.[0] || !dates[1]) return
  props.filters.patch({
    from: dates[0].format('YYYY-MM-DD'),
    to: dates[1].format('YYYY-MM-DD'),
  })
}

const bankOptions = computed(() =>
  props.banks.map((b) => ({ value: b.id, label: b.name })),
)

const listFilters = DEBT_INSTALLMENT_LIST_FILTERS

function filterSelectOption(input: string, option: unknown): boolean {
  const opt = option as { label?: unknown }
  return textIncludesSearch(String(opt.label ?? ''), input)
}

interface NumberRangeState {
  min?: number
  max?: number
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

function getSelectValue(key: string): string {
  return query.rawValue(key)
}

function setSelectValue(key: string, value: string | undefined): void {
  query.rawPatch({ [key]: value })
  query.patch({ page: 1 })
}

function filterActiveFor(f: ListFilter<DebtInstallmentRow>): boolean {
  if (f.kind === 'select') return Boolean(query.rawValue(f.key))
  return Boolean(query.rawValue(`${f.key}From`) || query.rawValue(`${f.key}To`))
}

const activeFilterCount = computed(() => {
  let n = listFilters.filter(filterActiveFor).length
  if (props.filters.bankId.value) n++
  if (analyticsRangeQueryActive(route)) n++
  return n
})

const filtered = computed(() =>
  filterDebtInstallmentRows(props.rows, query, search.value),
)

const statusTag = (record: DebtInstallmentRow) => debtInstallmentStatusDisplay(record)

const baseColumns: ColumnsType<DebtInstallmentRow> = [
  {
    title: 'Borç',
    dataIndex: 'debtName',
    key: 'debtName',
    sorter: (a, b) => a.debtName.localeCompare(b.debtName, 'tr'),
  },
  {
    title: 'Banka',
    dataIndex: 'bankName',
    key: 'bankName',
    ellipsis: { showTitle: false },
    sorter: (a, b) => a.bankName.localeCompare(b.bankName, 'tr'),
  },
  {
    title: 'Tür',
    key: 'debtKind',
    sorter: (a, b) =>
      debtInstallmentTypeLabel(a).localeCompare(debtInstallmentTypeLabel(b), 'tr'),
    customRender: ({ record }) => debtInstallmentTypeLabel(record),
  },
  {
    title: 'Vade',
    dataIndex: 'dueDate',
    key: 'dueDate',
    sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
    defaultSortOrder: 'ascend',
    customRender: ({ text }) => formatDate(String(text)),
  },
  {
    title: 'Tutar',
    key: 'amount',
    align: 'right',
    sorter: (a, b) =>
      Number(debtInstallmentTableAmount(a)) - Number(debtInstallmentTableAmount(b)),
    customRender: ({ record }) =>
      formatCurrency(debtInstallmentTableAmount(record), props.currency),
  },
  {
    title: 'Ödenen',
    key: 'paidAmount',
    align: 'right',
    sorter: (a, b) => debtInstallmentPaidDisplay(a) - debtInstallmentPaidDisplay(b),
    customRender: ({ record }) => {
      const paid = debtInstallmentPaidDisplay(record)
      if (paid <= 0) return '—'
      return formatCurrency(String(paid), props.currency)
    },
  },
  {
    title: 'Durum',
    key: 'status',
    customRender: ({ record }) => {
      const t = statusTag(record)
      return h(Tag, { color: t.color }, () => t.label)
    },
  },
]

interface EffectiveSort {
  key: string
  order: 'ascend' | 'descend'
}

function columnKey(col: (typeof baseColumns)[number]): string {
  return String(col.key ?? ('dataIndex' in col ? col.dataIndex : '') ?? '')
}

const effectiveSort = computed<EffectiveSort | null>(() => {
  if (sortKey.value && sortOrder.value) {
    return { key: sortKey.value, order: sortOrder.value as 'ascend' | 'descend' }
  }
  for (const col of baseColumns) {
    const k = columnKey(col)
    const def = col.defaultSortOrder as 'ascend' | 'descend' | undefined
    if (k && (def === 'ascend' || def === 'descend')) {
      return { key: k, order: def }
    }
  }
  return null
})

const tableColumns = computed(() => {
  const eff = effectiveSort.value
  return prepareListTableColumns(baseColumns).map((col) => {
    const key = String(col.key ?? col.dataIndex ?? '')
    const sortOrderForCol = eff && eff.key === key ? eff.order : null
    return {
      ...col,
      sortOrder: sortOrderForCol,
    }
  })
})

const sortedItems = computed(() => {
  const eff = effectiveSort.value
  if (!eff) return filtered.value
  const col = baseColumns.find((c) => columnKey(c) === eff.key)
  const sorter = col?.sorter
  if (typeof sorter !== 'function') return filtered.value
  const list = [...filtered.value]
  const sign = eff.order === 'descend' ? -1 : 1
  list.sort((a, b) => sorter(a, b) * sign)
  return list
})

const pagination = computed<TablePaginationConfig>(() =>
  listTablePaginationConfig({
    current: page.value,
    pageSize: pageSize.value,
    total: filtered.value.length,
    pageSizeOptions: ['10', '15', '25', '50'],
    showTotal: (total) => `${total} kayıt`,
  }),
)

interface TableSorter {
  columnKey?: string | number
  order?: 'ascend' | 'descend' | false | null
}

function onTableChange(
  pag: TablePaginationConfig,
  _filters: unknown,
  sorter: TableSorter | TableSorter[],
  extra?: { action?: 'paginate' | 'sort' | 'filter' },
): void {
  applyListTableChange(query, pageSize.value, pag, sorter, extra, {
    sortKey: 'dueDate',
    sortOrder: 'ascend',
  })
}

function clearFilters(): void {
  clearAnalyticsListRouteQuery({
    route,
    router,
    stateKey: 'debtInstallments',
    listFilters,
    sharedQueryKeys: ['bank', 'from', 'to'],
  })
}
</script>

<template>
  <div class="kp-analytics-debt-list">
    <div ref="filterTriggerRef" class="kp-analytics-debt-list__toolbar">
      <div class="kp-analytics-debt-list__search-group">
        <Input
          v-model:value="search"
          placeholder="Borç veya banka ara…"
          allow-clear
          class="kp-analytics-debt-list__search"
          @change="query.patch({ page: 1 })"
        >
          <template #prefix><SearchOutlined /></template>
        </Input>

        <KpListFilterOverlay
          v-model:open="filtersOpen"
          stack-id="analytics-debt-installments-filter"
          :popover-props="filterPopoverProps"
        >
          <header class="kp-list-filter__head">Filtreler</header>

          <div class="kp-list-filter__field">
                <label class="kp-list-filter__label">Tarih aralığı</label>
                <LocaleRangePicker
                  :value="analyticsRangeValue"
                  class="kp-list-filter__control"
                  :allow-clear="false"
                  @update:value="(v: unknown) => onAnalyticsRangeChange(v as [Dayjs, Dayjs] | null)"
                />
              </div>

              <div class="kp-list-filter__field">
                <label class="kp-list-filter__label">Banka</label>
                <KpSelect
                  :value="filters.bankId.value || undefined"
                  class="kp-list-filter__control"
                  placeholder="Tüm bankalar"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  :options="bankOptions"
                  :filter-option="filterSelectOption"
                  @update:value="(v) => (filters.bankId.value = String(v ?? ''))"
                />
              </div>

              <div
                v-for="f in listFilters"
                :key="f.key"
                class="kp-list-filter__field"
              >
                <label class="kp-list-filter__label">{{ f.label }}</label>

                <KpSelect
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
              </div>

          <template #footer>
            <Button block :disabled="activeFilterCount === 0" @click="clearFilters">
              Filtreyi temizle
            </Button>
          </template>
          <template #trigger>
            <Badge :count="activeFilterCount" :show-zero="false" :offset="[-2, 2]" size="small">
              <Button
                class="kp-analytics-debt-list__filter-trigger"
                :type="activeFilterCount > 0 ? 'primary' : 'default'"
                :ghost="activeFilterCount > 0"
                aria-label="Filtreler"
              >
                <template #icon><FilterOutlined /></template>
              </Button>
            </Badge>
          </template>
        </KpListFilterOverlay>
      </div>
    </div>

    <Table
      :columns="tableColumns"
      :data-source="sortedItems"
      row-key="key"
      size="small"
      :pagination="pagination"
      table-layout="auto"
      :scroll="{ x: TABLE_SCROLL_X }"
      :show-sorter-tooltip="false"
      @change="onTableChange"
    />
  </div>
</template>

<style scoped>
.kp-analytics-debt-list__toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.kp-analytics-debt-list__search-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.kp-analytics-debt-list__filter-trigger {
  flex-shrink: 0;
}
</style>
