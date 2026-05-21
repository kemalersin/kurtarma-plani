<script setup lang="ts" generic="T">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Empty, Table } from 'ant-design-vue'
import type { TableColumnType, TablePaginationConfig } from 'ant-design-vue'
import TableRowActions from '@/components/TableRowActions.vue'
import {
  LIST_ACTIONS_COLUMN_WIDTH,
  listColumnScrollWidth,
  prepareListTableColumns,
} from '@/core/util/table-columns'

const props = withDefaults(
  defineProps<{
    columns: TableColumnType<T>[]
    dataSource: T[]
    rowKey: string | ((record: T) => string | number)
    pagination?: false | TablePaginationConfig
    /**
     * Sabit dikey kaydırma yüksekliği. Verilmezse sarmalayıcı ölçülür (drawer kalan alan).
     */
    scrollY?: number | string
    /** `scrollY` verilmediğinde kalan dikey alanı doldur (varsayılan: true). */
    fillHeight?: boolean
    customRow?: (record: T) => Record<string, unknown>
    size?: 'small' | 'middle'
    tableClass?: string
    emptyText?: string
    /** Düzenle / sil ikon sütunu (`EntityListPage` ile aynı). */
    rowActions?: boolean
    deleteTitle?: string
    /** Sil düğmesi gösterilsin mi (kayıt bazlı). */
    canDelete?: (record: T) => boolean
  }>(),
  {
    pagination: false,
    size: 'small',
    fillHeight: true,
    emptyText: 'Henüz kayıt yok.',
    rowActions: false,
    deleteTitle: 'Bu kayıt silinsin mi?',
    canDelete: () => true,
  },
)

const emit = defineEmits<{
  (e: 'edit', record: T): void
  (e: 'delete', record: T): void
}>()

const tableLocale = { emptyText: ' ' }

const wrapRef = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const measuredScrollY = ref(120)
const tableHeadH = ref(40)
const tablePaginationH = ref(0)
let resizeObserver: ResizeObserver | null = null

const useFillHeight = computed(
  () => props.fillHeight && props.scrollY == null,
)

const showEmptyOverlay = computed(() => props.dataSource.length === 0)

const preparedColumns = computed<TableColumnType<T>[]>(() =>
  prepareListTableColumns(props.columns).map((col) => {
    const ellipsis =
      col.ellipsis === true
        ? ({ showTitle: false } as { showTitle: false })
        : col.ellipsis
    return { ...col, ellipsis } as TableColumnType<T>
  }),
)

const displayColumns = computed<TableColumnType<T>[]>(() => {
  const cols = preparedColumns.value
  if (!props.rowActions) return cols
  if (cols.some((c) => String(c.key ?? '') === '__actions')) return cols
  return [
    ...cols,
    {
      key: '__actions',
      title: '',
      align: 'right',
      width: LIST_ACTIONS_COLUMN_WIDTH,
    },
  ]
})

const columnsMinWidth = computed(() =>
  displayColumns.value.reduce(
    (sum, col) => sum + listColumnScrollWidth(col as TableColumnType<unknown>),
    0,
  ),
)

const needsHorizontalScroll = computed(() => {
  const vw = viewportWidth.value
  if (vw <= 0) return false
  return columnsMinWidth.value > vw + 1
})

const effectiveScrollY = computed(() => {
  if (props.scrollY != null) return props.scrollY
  if (useFillHeight.value) return measuredScrollY.value
  return undefined
})

const scroll = computed(() => {
  const s: { x?: number; y?: number | string } = {}
  if (needsHorizontalScroll.value) s.x = columnsMinWidth.value
  const y = effectiveScrollY.value
  if (y != null) s.y = y
  return Object.keys(s).length > 0 ? s : undefined
})

const wrapStyle = computed(() => {
  const style: Record<string, string> = {}
  if (useFillHeight.value) {
    style['--kp-drawer-table-body-min-h'] = `${measuredScrollY.value}px`
  }
  style['--kp-drawer-table-head-h'] = `${tableHeadH.value}px`
  style['--kp-drawer-table-pagination-h'] = `${tablePaginationH.value}px`
  return style
})

async function measureTable(): Promise<void> {
  await nextTick()
  const wrap = wrapRef.value
  if (!wrap) return
  viewportWidth.value = wrap.clientWidth

  const thead = wrap.querySelector<HTMLElement>('.ant-table-thead')
  const paginationEl = wrap.querySelector<HTMLElement>('.ant-table-pagination')
  tableHeadH.value = thead?.offsetHeight ?? 40
  tablePaginationH.value = paginationEl ? paginationEl.offsetHeight + 16 : 0

  if (!useFillHeight.value) return
  const reserved = tableHeadH.value + tablePaginationH.value + 4
  measuredScrollY.value = Math.max(120, wrap.clientHeight - reserved)
}

function bindResizeObserver(el: HTMLElement | null): void {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!el) return
  resizeObserver = new ResizeObserver(() => {
    void measureTable()
  })
  resizeObserver.observe(el)
}

function scheduleMeasure(): void {
  void measureTable()
  requestAnimationFrame(() => void measureTable())
}

onMounted(() => {
  bindResizeObserver(wrapRef.value)
  scheduleMeasure()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(wrapRef, (el) => {
  bindResizeObserver(el)
  if (el) scheduleMeasure()
})

watch(
  () =>
    [
      props.columns.length,
      props.dataSource.length,
      props.pagination,
      props.scrollY,
      props.fillHeight,
      props.rowActions,
    ] as const,
  () => scheduleMeasure(),
)

function showDeleteFor(record: T): boolean {
  return props.canDelete(record)
}
</script>

<template>
  <div
    ref="wrapRef"
    class="kp-drawer-table"
    :class="{
      'kp-drawer-table--h-scroll': needsHorizontalScroll,
      'kp-drawer-table--fill': useFillHeight,
      'kp-drawer-table--empty': showEmptyOverlay,
    }"
    :style="wrapStyle"
  >
    <div v-if="showEmptyOverlay" class="kp-drawer-table__empty" role="status">
      <Empty :description="emptyText" />
    </div>

    <Table
      :class="tableClass"
      :data-source="dataSource"
      :columns="displayColumns"
      :row-key="rowKey"
      :pagination="pagination"
      :scroll="scroll"
      :locale="tableLocale"
      :custom-row="customRow"
      :show-sorter-tooltip="false"
      table-layout="fixed"
      :size="size"
    >
      <template #bodyCell="scope">
        <template v-if="scope.column.key === '__actions' && rowActions">
          <TableRowActions
            :show-delete="showDeleteFor(scope.record as T)"
            :delete-title="deleteTitle"
            @edit="emit('edit', scope.record as T)"
            @delete="emit('delete', scope.record as T)"
          />
        </template>
        <template v-else-if="$slots.bodyCell">
          <slot name="bodyCell" v-bind="scope" />
        </template>
      </template>
    </Table>
  </div>
</template>

<style scoped>
.kp-drawer-table {
  width: 100%;
  min-width: 0;
}

.kp-drawer-table--fill,
.kp-drawer-table--empty {
  position: relative;
}

.kp-drawer-table--fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-drawer-table__empty {
  position: absolute;
  top: var(--kp-drawer-table-head-h, 40px);
  right: 0;
  bottom: var(--kp-drawer-table-pagination-h, 0px);
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.kp-drawer-table--empty :deep(tr.ant-table-placeholder),
.kp-drawer-table--empty :deep(.ant-table-placeholder .ant-empty) {
  display: none;
}

.kp-drawer-table--fill :deep(.ant-table-wrapper) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.kp-drawer-table--fill :deep(.ant-spin-nested-loading),
.kp-drawer-table--fill :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.kp-drawer-table--fill :deep(.ant-table) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-drawer-table--fill :deep(.ant-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-drawer-table--fill :deep(.ant-table-header) {
  flex-shrink: 0;
}

.kp-drawer-table--fill :deep(.ant-table-pagination) {
  flex-shrink: 0;
  margin: 16px 0 0;
}

.kp-drawer-table :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.kp-drawer-table :deep(.ant-table-body) {
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

.kp-drawer-table--fill :deep(.ant-table-body) {
  flex: 1;
  min-height: var(--kp-drawer-table-body-min-h, 120px);
  padding-bottom: 6px;
}

.kp-drawer-table--h-scroll :deep(.ant-table-body) {
  overflow-x: auto !important;
}

.kp-drawer-table :deep(.ant-table-header),
.kp-drawer-table :deep(.ant-table-body) {
  width: 100% !important;
}

.kp-drawer-table :deep(.ant-table-cell-scrollbar),
.kp-drawer-table :deep(col.ant-table-cell-scrollbar) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  padding: 0 !important;
  border: none !important;
}
</style>
