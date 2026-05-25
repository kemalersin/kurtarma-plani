<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { message, Popconfirm, Button } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import dayjs from 'dayjs'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import ExpenseFormDrawer from './ExpenseFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { KpTableColumn } from '@/core/util/table-columns'
import { cashflowStatus, type CashflowStatus } from '@/finance/cashflow'
import {
  CASHFLOW_STATUS_LABELS,
  cashflowStatusLabel,
  cashflowStatusTag,
} from '@/features/cashflow/cashflowLabels'
import { REALIZE_ACTION_BUTTON_STYLE } from '@/features/cashflow/realizeButtonStyle'
import {
  compareByDisplayLabel,
  compareCashflowActualDate,
  compareCashflowStatus,
} from '@/features/cashflow/cashflowListSorters'
import type {
  Account,
  CashRegister,
  Expense,
  ExpenseType,
} from '@/core/types/entities'

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const expenses = entities.list<Expense>('expense')
const types = entities.list<ExpenseType>('expenseType')
const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')
const loading = entities.loading('expense')

const formOpen = ref(false)
const editing = ref<Expense | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('expense').value)
    tasks.push(entities.load<Expense>('expense').catch(() => undefined))
  if (!entities.loaded('expenseType').value)
    tasks.push(entities.load<ExpenseType>('expenseType').catch(() => undefined))
  if (!entities.loaded('account').value)
    tasks.push(entities.load<Account>('account').catch(() => undefined))
  if (!entities.loaded('cashRegister').value)
    tasks.push(entities.load<CashRegister>('cashRegister').catch(() => undefined))
  if (tasks.length) await Promise.all(tasks)
})

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}
function openEdit(e: Expense): void {
  editing.value = e
  formOpen.value = true
}
async function remove(e: Expense): Promise<void> {
  try {
    await entities.remove('expense', e.id)
    message.success('Gider silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

async function markRealized(e: Expense): Promise<void> {
  try {
    await entities.save<Expense>('expense', {
      ...e,
      actualDate: e.actualDate ?? new Date().toISOString(),
    })
    message.success('Gider gerçekleşti olarak işaretlendi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Güncellenemedi.')
  }
}

async function unmarkRealized(e: Expense): Promise<void> {
  try {
    await entities.save<Expense>('expense', { ...e, actualDate: undefined })
    message.success('Gerçekleşti işareti kaldırıldı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Güncellenemedi.')
  }
}

function sourceName(e: Expense): string {
  if (e.accountId) return accounts.value.find((a) => a.id === e.accountId)?.name ?? '—'
  if (e.cashRegisterId)
    return registers.value.find((r) => r.id === e.cashRegisterId)?.name ?? '—'
  return '—'
}

function typeName(e: Expense): string {
  if (!e.expenseTypeId) return '—'
  return types.value.find((t) => t.id === e.expenseTypeId)?.name ?? '—'
}

function descriptionLabel(e: Expense): string {
  return e.description?.trim() || typeName(e)
}

const STATUS_LABELS = CASHFLOW_STATUS_LABELS

function statusLabel(e: Expense): string {
  return cashflowStatusLabel(e)
}

function sourceId(e: Expense): string {
  if (e.accountId) return `account:${e.accountId}`
  if (e.cashRegisterId) return `cash:${e.cashRegisterId}`
  return ''
}

const typeOptions = computed(() =>
  [...types.value]
    .filter((t) => !t.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((t) => ({ value: t.id, label: t.name })),
)

const sourceOptions = computed(() => {
  const items = [
    ...accounts.value
      .filter((a) => !a.archived)
      .map((a) => ({ value: `account:${a.id}`, label: `Hesap · ${a.name}` })),
    ...registers.value
      .filter((r) => !r.archived)
      .map((r) => ({ value: `cash:${r.id}`, label: `Kasa · ${r.name}` })),
  ]
  return items.sort((a, b) => a.label.localeCompare(b.label, 'tr'))
})

const filters = computed<ListFilter<Expense>[]>(() => [
  {
    kind: 'select',
    key: 'type',
    label: 'Gider türü',
    placeholder: 'Tüm türler',
    options: typeOptions.value,
    getValue: (e) => e.expenseTypeId ?? null,
  },
  {
    kind: 'select',
    key: 'source',
    label: 'Kaynak',
    placeholder: 'Tüm kaynaklar',
    options: sourceOptions.value,
    getValue: sourceId,
  },
  {
    kind: 'select',
    key: 'status',
    label: 'Durum',
    placeholder: 'Tüm durumlar',
    options: (Object.keys(STATUS_LABELS) as CashflowStatus[]).map((value) => ({
      value,
      label: STATUS_LABELS[value],
    })),
    getValue: (e) => cashflowStatus(e),
  },
  {
    kind: 'numberRange',
    key: 'amount',
    label: 'Tutar',
    numberKind: 'currency',
    getValue: (e) => e.amount,
  },
  {
    kind: 'dateRange',
    key: 'planned',
    label: 'Plan tarihi',
    getValue: (e) => e.plannedDate,
  },
  {
    kind: 'dateRange',
    key: 'actual',
    label: 'Gerçek tarihi',
    getValue: (e) => e.actualDate ?? null,
  },
])

const columns = computed<TableColumnType<Expense>[]>(() => [
  {
    key: 'name',
    title: 'Açıklama',
    ellipsis: { showTitle: false },
    customRender: ({ record }) => descriptionLabel(record as Expense),
    sorter: (a, b) => compareByDisplayLabel(a, b, descriptionLabel),
  },
  {
    key: 'type',
    title: 'Tür',
    customRender: ({ record }) => typeName(record as Expense),
    sorter: (a, b) => compareByDisplayLabel(a, b, typeName),
  },
  {
    key: 'source',
    title: 'Kaynak',
    customRender: ({ record }) => sourceName(record as Expense),
    sorter: (a, b) => compareByDisplayLabel(a, b, sourceName),
  },
  {
    key: 'amount',
    title: 'Tutar',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as Expense).amount, (record as Expense).currency),
    sorter: (a, b) => a.amount - b.amount,
  },
  {
    key: 'plannedDate',
    title: 'Plan',
    customRender: ({ record }) => formatDate((record as Expense).plannedDate),
    sorter: (a, b) => a.plannedDate.localeCompare(b.plannedDate),
    defaultSortOrder: 'descend',
  },
  {
    key: 'actualDate',
    title: 'Gerçek',
    customRender: ({ record }) =>
      (record as Expense).actualDate ? formatDate((record as Expense).actualDate!) : '—',
    sorter: compareCashflowActualDate,
  },
  {
    key: 'status',
    title: 'Durum',
    kpDisplay: (e) => statusLabel(e),
    kpTag: (e) => cashflowStatusTag(e),
    sorter: compareCashflowStatus,
  } satisfies KpTableColumn<Expense>,
  {
    key: '__realize',
    title: '',
    align: 'center',
    customRender: ({ record }) => {
      const row = record as Expense
      if (row.recurrence) return null
      if (!row.actualDate) {
        return h(
          Popconfirm,
          {
            title: `Bu gideri ${dayjs().format('DD.MM.YYYY')} olarak gerçekleşti işaretlemek istiyor musun?`,
            okText: 'Evet',
            cancelText: 'Vazgeç',
            onConfirm: () => markRealized(row),
          },
          () =>
            h(
              Button,
              {
                type: 'primary',
                ghost: true,
                size: 'small',
                style: REALIZE_ACTION_BUTTON_STYLE,
                onClick: (e: MouseEvent) => e.stopPropagation(),
              },
              () => 'Gerçekleşti',
            ),
        )
      }
      return h(
        Button,
        {
          size: 'small',
          danger: true,
          style: REALIZE_ACTION_BUTTON_STYLE,
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            void unmarkRealized(row)
          },
        },
        () => 'Geri al',
      )
    },
  },
  { key: 'archived', title: '' },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="expenses"
      state-key="expenses"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['description', 'notes']"
      search-placeholder="Gider ara…"
      create-label="Yeni gider"
      empty-text="Henüz gider eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <ExpenseFormDrawer v-model:open="formOpen" :expense="editing" />
  </div>
</template>
