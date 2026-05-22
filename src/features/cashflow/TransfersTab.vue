<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import TransferFormDrawer from './TransferFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { ADMIN_PRIMARY_NAME_COLUMN_WIDTH } from '@/features/admin/admin-list-columns'
import type { Account, CashRegister, Transfer } from '@/core/types/entities'

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const transfers = entities.list<Transfer>('transfer')
const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')
const loading = entities.loading('transfer')

const formOpen = ref(false)
const editing = ref<Transfer | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('transfer').value)
    tasks.push(entities.load<Transfer>('transfer').catch(() => undefined))
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
function openEdit(t: Transfer): void {
  editing.value = t
  formOpen.value = true
}
async function remove(t: Transfer): Promise<void> {
  try {
    await entities.remove('transfer', t.id)
    message.success('Transfer silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function fromId(t: Transfer): string {
  if (t.fromAccountId) return `account:${t.fromAccountId}`
  if (t.fromCashRegisterId) return `cash:${t.fromCashRegisterId}`
  return ''
}

function toId(t: Transfer): string {
  if (t.toAccountId) return `account:${t.toAccountId}`
  if (t.toCashRegisterId) return `cash:${t.toCashRegisterId}`
  return ''
}

const endpointOptions = computed(() => {
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

const filters = computed<ListFilter<Transfer>[]>(() => [
  {
    kind: 'select',
    key: 'from',
    label: 'Kaynak',
    placeholder: 'Tüm kaynaklar',
    options: endpointOptions.value,
    getValue: fromId,
  },
  {
    kind: 'select',
    key: 'to',
    label: 'Hedef',
    placeholder: 'Tüm hedefler',
    options: endpointOptions.value,
    getValue: toId,
  },
  {
    kind: 'numberRange',
    key: 'amount',
    label: 'Tutar',
    numberKind: 'currency',
    getValue: (t) => t.amount,
  },
  {
    kind: 'dateRange',
    key: 'date',
    label: 'Tarih',
    getValue: (t) => t.date,
  },
])

function fromName(t: Transfer): string {
  if (t.fromAccountId)
    return accounts.value.find((a) => a.id === t.fromAccountId)?.name ?? '—'
  if (t.fromCashRegisterId)
    return registers.value.find((r) => r.id === t.fromCashRegisterId)?.name ?? '—'
  return '—'
}
function toName(t: Transfer): string {
  if (t.toAccountId)
    return accounts.value.find((a) => a.id === t.toAccountId)?.name ?? '—'
  if (t.toCashRegisterId)
    return registers.value.find((r) => r.id === t.toCashRegisterId)?.name ?? '—'
  return '—'
}

const columns = computed<TableColumnType<Transfer>[]>(() => [
  {
    key: 'name',
    title: 'Açıklama',
    width: ADMIN_PRIMARY_NAME_COLUMN_WIDTH,
    ellipsis: true,
    defaultSortOrder: 'descend',
    customRender: ({ record }) =>
      (record as Transfer).description?.trim() ||
      `${fromName(record as Transfer)} → ${toName(record as Transfer)}`,
    sorter: (a, b) =>
      (a.description ?? '').localeCompare(b.description ?? '', 'tr'),
  },
  {
    key: 'from',
    title: 'Kaynak',
    customRender: ({ record }) => fromName(record as Transfer),
  },
  {
    key: 'to',
    title: 'Hedef',
    customRender: ({ record }) => toName(record as Transfer),
  },
  {
    key: 'amount',
    title: 'Tutar',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as Transfer).amount, (record as Transfer).currency),
    sorter: (a, b) => a.amount - b.amount,
  },
  {
    key: 'date',
    title: 'Tarih',
    customRender: ({ record }) => formatDate((record as Transfer).date),
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
  },
  { key: 'archived', title: '' },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="transfers"
      state-key="transfers"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['description', 'notes']"
      search-placeholder="Transfer ara…"
      create-label="Yeni transfer"
      empty-text="Henüz transfer eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <TransferFormDrawer v-model:open="formOpen" :transfer="editing" />
  </div>
</template>
