<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import CashRegisterFormDrawer from '@/features/admin/CashRegisterFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useAccountBalances } from '@/features/cashflow/useAccountBalances'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { CashRegister } from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'
import {
  compareNumeric,
  compareIsoDate,
  compareOptionalString,
} from '@/features/admin/adminListSorters'

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()
const registers = entities.list<CashRegister>('cashRegister')
const loading = entities.loading('cashRegister')
const { balancesByCashRegister } = useAccountBalances()

function currentBalance(register: CashRegister): number {
  const raw = balancesByCashRegister.value[register.id]
  return raw == null ? register.openingBalance : Number(raw)
}

const drawerOpen = ref(false)
const editing = ref<CashRegister | null>(null)

onMounted(async () => {
  if (!entities.loaded('cashRegister').value) {
    await entities.load<CashRegister>('cashRegister').catch(() => undefined)
  }
})

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openEdit(register: CashRegister): void {
  editing.value = register
  drawerOpen.value = true
}

async function remove(register: CashRegister): Promise<void> {
  try {
    await entities.remove('cashRegister', register.id)
    message.success('Kasa silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function formatBalance(amount: number, currency: string): string {
  return formatCurrency(amount, currency)
}

const filters = computed<ListFilter<CashRegister>[]>(() => [
  {
    kind: 'numberRange',
    key: 'opening',
    label: 'Açılış bakiyesi',
    numberKind: 'currency',
    getValue: (r) => r.openingBalance,
  },
  {
    kind: 'numberRange',
    key: 'currentBalance',
    label: 'Güncel bakiye',
    numberKind: 'currency',
    getValue: (r) => currentBalance(r),
  },
  {
    kind: 'dateRange',
    key: 'opened',
    label: 'Açılış tarihi',
    getValue: (r) => r.openingDate,
  },
])

const columns = computed<TableColumnType<CashRegister>[]>(() => [
  adminPrimaryNameColumn<CashRegister>('Kasa'),
  {
    key: 'currency',
    title: 'Para',
    dataIndex: 'currency',
    sorter: (a, b) => compareOptionalString(a.currency, b.currency),
  },
  {
    key: 'openingBalance',
    title: 'Açılış bakiyesi',
    align: 'right',
    kpDisplay: (register: CashRegister) => formatBalance(register.openingBalance, register.currency),
    customRender: ({ record }) =>
      formatBalance((record as CashRegister).openingBalance, (record as CashRegister).currency),
    sorter: (a, b) => compareNumeric(a, b, (register) => register.openingBalance),
  },
  {
    key: 'currentBalance',
    title: 'Güncel bakiye',
    align: 'right',
    kpDisplay: (register: CashRegister) => formatBalance(currentBalance(register), register.currency),
    customRender: ({ record }) => {
      const register = record as CashRegister
      const value = currentBalance(register)
      const text = formatBalance(value, register.currency)
      const cls = value < 0 ? 'kp-balance kp-balance--negative' : 'kp-balance'
      return h('span', { class: cls }, text)
    },
    sorter: (a, b) => compareNumeric(a, b, (register) => currentBalance(register)),
  },
  {
    key: 'openingDate',
    title: 'Açılış tarihi',
    customRender: ({ record }) => formatDate((record as CashRegister).openingDate),
    sorter: (a, b) => compareIsoDate(a.openingDate, b.openingDate),
  },
  {
    key: 'archived',
    title: 'Durum',
  },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="registers"
      state-key="cash"
      search-placeholder="Kasa ara…"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['name', 'currency']"
      create-label="Yeni kasa"
      empty-text="Henüz kasa eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <CashRegisterFormDrawer v-model:open="drawerOpen" :register="editing" />
  </div>
</template>
