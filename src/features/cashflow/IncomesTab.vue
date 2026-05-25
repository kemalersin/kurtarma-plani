<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { message, Popconfirm, Button } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import dayjs from 'dayjs'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import IncomeFormDrawer from './IncomeFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { ADMIN_PRIMARY_NAME_COLUMN_WIDTH } from '@/features/admin/admin-list-columns'
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
  Income,
  IncomeType,
} from '@/core/types/entities'

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const incomes = entities.list<Income>('income')
const types = entities.list<IncomeType>('incomeType')
const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')
const loading = entities.loading('income')

const formOpen = ref(false)
const editing = ref<Income | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('income').value)
    tasks.push(entities.load<Income>('income').catch(() => undefined))
  if (!entities.loaded('incomeType').value)
    tasks.push(entities.load<IncomeType>('incomeType').catch(() => undefined))
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
function openEdit(i: Income): void {
  editing.value = i
  formOpen.value = true
}
async function remove(i: Income): Promise<void> {
  try {
    await entities.remove('income', i.id)
    message.success('Gelir silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

async function markRealized(i: Income): Promise<void> {
  try {
    await entities.save<Income>('income', {
      ...i,
      actualDate: i.actualDate ?? new Date().toISOString(),
    })
    message.success('Gelir gerçekleşti olarak işaretlendi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Güncellenemedi.')
  }
}

async function unmarkRealized(i: Income): Promise<void> {
  try {
    await entities.save<Income>('income', { ...i, actualDate: undefined })
    message.success('Gerçekleşti işareti kaldırıldı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Güncellenemedi.')
  }
}

function targetName(i: Income): string {
  if (i.accountId) return accounts.value.find((a) => a.id === i.accountId)?.name ?? '—'
  if (i.cashRegisterId)
    return registers.value.find((r) => r.id === i.cashRegisterId)?.name ?? '—'
  return '—'
}

function typeName(i: Income): string {
  if (!i.incomeTypeId) return '—'
  return types.value.find((t) => t.id === i.incomeTypeId)?.name ?? '—'
}

function descriptionLabel(i: Income): string {
  return i.description?.trim() || typeName(i)
}

const STATUS_LABELS = CASHFLOW_STATUS_LABELS

function statusLabel(i: Income): string {
  return cashflowStatusLabel(i)
}

function targetId(i: Income): string {
  if (i.accountId) return `account:${i.accountId}`
  if (i.cashRegisterId) return `cash:${i.cashRegisterId}`
  return ''
}

const typeOptions = computed(() =>
  [...types.value]
    .filter((t) => !t.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((t) => ({ value: t.id, label: t.name })),
)

const targetOptions = computed(() => {
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

const filters = computed<ListFilter<Income>[]>(() => [
  {
    kind: 'select',
    key: 'type',
    label: 'Gelir türü',
    placeholder: 'Tüm türler',
    options: typeOptions.value,
    getValue: (i) => i.incomeTypeId ?? null,
  },
  {
    kind: 'select',
    key: 'target',
    label: 'Hedef',
    placeholder: 'Tüm hedefler',
    options: targetOptions.value,
    getValue: targetId,
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
    getValue: (i) => cashflowStatus(i),
  },
  {
    kind: 'numberRange',
    key: 'amount',
    label: 'Tutar',
    numberKind: 'currency',
    getValue: (i) => i.amount,
  },
  {
    kind: 'dateRange',
    key: 'planned',
    label: 'Plan tarihi',
    getValue: (i) => i.plannedDate,
  },
  {
    kind: 'dateRange',
    key: 'actual',
    label: 'Gerçek tarihi',
    getValue: (i) => i.actualDate ?? null,
  },
])

const columns = computed<TableColumnType<Income>[]>(() => [
  {
    key: 'name',
    title: 'Açıklama',
    width: ADMIN_PRIMARY_NAME_COLUMN_WIDTH,
    ellipsis: true,
    customRender: ({ record }) => descriptionLabel(record as Income),
    sorter: (a, b) => compareByDisplayLabel(a, b, descriptionLabel),
  },
  {
    key: 'type',
    title: 'Tür',
    customRender: ({ record }) => typeName(record as Income),
    sorter: (a, b) => compareByDisplayLabel(a, b, typeName),
  },
  {
    key: 'target',
    title: 'Hedef',
    customRender: ({ record }) => targetName(record as Income),
    sorter: (a, b) => compareByDisplayLabel(a, b, targetName),
  },
  {
    key: 'amount',
    title: 'Tutar',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as Income).amount, (record as Income).currency),
    sorter: (a, b) => a.amount - b.amount,
  },
  {
    key: 'plannedDate',
    title: 'Plan',
    customRender: ({ record }) => formatDate((record as Income).plannedDate),
    sorter: (a, b) => a.plannedDate.localeCompare(b.plannedDate),
    defaultSortOrder: 'descend',
  },
  {
    key: 'actualDate',
    title: 'Gerçek',
    customRender: ({ record }) =>
      (record as Income).actualDate ? formatDate((record as Income).actualDate!) : '—',
    sorter: compareCashflowActualDate,
  },
  {
    key: 'status',
    title: 'Durum',
    kpDisplay: (i) => statusLabel(i),
    kpTag: (i) => cashflowStatusTag(i),
    sorter: compareCashflowStatus,
  } satisfies KpTableColumn<Income>,
  {
    key: '__realize',
    title: '',
    align: 'center',
    width: 120,
    customRender: ({ record }) => {
      const row = record as Income
      if (row.recurrence) return null
      if (!row.actualDate) {
        return h(
          Popconfirm,
          {
            title: `Bu geliri ${dayjs().format('DD.MM.YYYY')} olarak gerçekleşti işaretlemek istiyor musun?`,
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
      :items="incomes"
      state-key="incomes"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['description', 'notes']"
      search-placeholder="Gelir ara…"
      create-label="Yeni gelir"
      empty-text="Henüz gelir eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <IncomeFormDrawer v-model:open="formOpen" :income="editing" />
  </div>
</template>
