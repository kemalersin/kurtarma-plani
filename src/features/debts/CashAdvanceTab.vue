<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { HistoryOutlined } from '@ant-design/icons-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import CashAdvanceFormDrawer from './CashAdvanceFormDrawer.vue'
import CashAdvanceLedgerDrawer from './CashAdvanceLedgerDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { useCreditCardRateContext } from '@/composables/useCreditCardRateContext'
import type {
  Bank,
  CashAdvanceAccount,
  CashAdvanceTransaction,
} from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'
import { compareByDisplayLabel, compareNumeric } from '@/features/debts/debtListSorters'
import { cashAdvanceState } from './cashAdvanceHelpers'

const entities = useEntitiesStore()
const { formatCurrency } = useLocaleFormatters()
const { taxRateMonthly } = useCreditCardRateContext()

const accounts = entities.list<CashAdvanceAccount>('cashAdvanceAccount')
const txns = entities.list<CashAdvanceTransaction>('cashAdvanceTransaction')
const banks = entities.list<Bank>('bank')
const loading = computed(
  () =>
    entities.loading('cashAdvanceAccount').value ||
    entities.loading('cashAdvanceTransaction').value ||
    entities.loading('bank').value,
)

const formOpen = ref(false)
const ledgerOpen = ref(false)
const editing = ref<CashAdvanceAccount | null>(null)
const inspecting = ref<CashAdvanceAccount | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('cashAdvanceAccount').value)
    tasks.push(entities.load<CashAdvanceAccount>('cashAdvanceAccount').catch(() => undefined))
  if (!entities.loaded('cashAdvanceTransaction').value)
    tasks.push(
      entities.load<CashAdvanceTransaction>('cashAdvanceTransaction').catch(() => undefined),
    )
  if (!entities.loaded('bank').value)
    tasks.push(entities.load<Bank>('bank').catch(() => undefined))
  if (tasks.length) await Promise.all(tasks)
})

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}
function openEdit(a: CashAdvanceAccount): void {
  editing.value = a
  formOpen.value = true
}
function openLedger(a: CashAdvanceAccount): void {
  inspecting.value = a
  ledgerOpen.value = true
}
async function remove(a: CashAdvanceAccount): Promise<void> {
  try {
    await entities.remove('cashAdvanceAccount', a.id)
    const own = txns.value.filter((t) => t.accountId === a.id)
    for (const t of own) await entities.remove('cashAdvanceTransaction', t.id)
    message.success('Hesap silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function bankName(id: string): string {
  return banks.value.find((b) => b.id === id)?.name ?? '—'
}

const summaryCache = computed<
  Map<
    string,
    {
      principal: string
      accrued: string
      total: string
      minPayment: string
      available: number
    }
  >
>(() => {
  const map = new Map<
    string,
    {
      principal: string
      accrued: string
      total: string
      minPayment: string
      available: number
    }
  >()
  for (const account of accounts.value) {
    const state = cashAdvanceState(account, txns.value, undefined, taxRateMonthly.value)
    map.set(account.id, {
      principal: state.principal,
      accrued: state.accruedInterest,
      total: state.total,
      minPayment: state.minPayment,
      available: account.limit - Number(state.principal),
    })
  }
  return map
})

function summary(a: CashAdvanceAccount) {
  return (
    summaryCache.value.get(a.id) ?? {
      principal: '0',
      accrued: '0',
      total: '0',
      minPayment: '0',
      available: a.limit,
    }
  )
}

const filters = computed<ListFilter<CashAdvanceAccount>[]>(() => [
  {
    kind: 'numberRange',
    key: 'limit',
    label: 'Limit',
    numberKind: 'currency',
    getValue: (account) => account.limit,
  },
  {
    kind: 'numberRange',
    key: 'principal',
    label: 'Anapara',
    numberKind: 'currency',
    getValue: (account) => Number(summary(account).principal),
  },
  {
    kind: 'numberRange',
    key: 'accrued',
    label: 'İşleyen faiz',
    numberKind: 'currency',
    getValue: (account) => Number(summary(account).accrued),
  },
  {
    kind: 'numberRange',
    key: 'total',
    label: 'Toplam borç',
    numberKind: 'currency',
    getValue: (account) => Number(summary(account).total),
  },
  {
    kind: 'numberRange',
    key: 'minPayment',
    label: 'Asgari ödeme',
    numberKind: 'currency',
    getValue: (account) => Number(summary(account).minPayment),
  },
  {
    kind: 'numberRange',
    key: 'available',
    label: 'Kullanılabilir',
    numberKind: 'currency',
    getValue: (account) => summary(account).available,
  },
])

const columns = computed<TableColumnType<CashAdvanceAccount>[]>(() => [
  adminPrimaryNameColumn<CashAdvanceAccount>('Hesap'),
  {
    key: 'bank',
    title: 'Banka',
    customRender: ({ record }) => bankName((record as CashAdvanceAccount).bankId),
    sorter: (a, b) => compareByDisplayLabel(a, b, (account) => bankName(account.bankId)),
  },
  {
    key: 'limit',
    title: 'Limit',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as CashAdvanceAccount).limit, (record as CashAdvanceAccount).currency),
    sorter: (a, b) => compareNumeric(a, b, (account) => account.limit),
  },
  {
    key: 'principal',
    title: 'Anapara',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as CashAdvanceAccount).principal,
        (record as CashAdvanceAccount).currency,
      ),
    sorter: (a, b) =>
      compareNumeric(a, b, (account) => Number(summary(account).principal)),
  },
  {
    key: 'accrued',
    title: 'İşleyen faiz',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as CashAdvanceAccount).accrued,
        (record as CashAdvanceAccount).currency,
      ),
    sorter: (a, b) =>
      compareNumeric(a, b, (account) => Number(summary(account).accrued)),
  },
  {
    key: 'total',
    title: 'Toplam',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as CashAdvanceAccount).total,
        (record as CashAdvanceAccount).currency,
      ),
    sorter: (a, b) => compareNumeric(a, b, (account) => Number(summary(account).total)),
  },
  {
    key: 'minPayment',
    title: 'Asgari',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as CashAdvanceAccount).minPayment,
        (record as CashAdvanceAccount).currency,
      ),
    sorter: (a, b) =>
      compareNumeric(a, b, (account) => Number(summary(account).minPayment)),
  },
  {
    key: 'available',
    title: 'Kullanılabilir',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as CashAdvanceAccount).available,
        (record as CashAdvanceAccount).currency,
      ),
    sorter: (a, b) => compareNumeric(a, b, (account) => summary(account).available),
  },
  { key: 'archived', title: '' },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="accounts"
      :loading="loading"
      :columns="columns"
      state-key="cash"
      bank-filter
      :banks="banks"
      :filters="filters"
      :search-keys="['name']"
      search-placeholder="Hesap ara…"
      create-label="Yeni hesap"
      empty-text="Henüz nakit avans hesabı eklenmedi."
      row-action-label="Hareketler"
      :row-action-icon="HistoryOutlined"
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
      @row-click="openLedger"
    />

    <CashAdvanceFormDrawer v-model:open="formOpen" :account="editing" />
    <CashAdvanceLedgerDrawer v-model:open="ledgerOpen" :account="inspecting" />
  </div>
</template>
