<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import BankFormDrawer from '@/features/admin/BankFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { debtTotalsByBankId } from '@/features/analytics/snapshot'
import type {
  Account,
  Bank,
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CreditCard,
  CreditCardTransaction,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import type { EntityType } from '@/core/db/profile-db'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'
import {
  compareNumeric,
  compareOptionalString,
} from '@/features/admin/adminListSorters'

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const { formatCurrency } = useLocaleFormatters()
const banks = entities.list<Bank>('bank')
const accounts = entities.list<Account>('account')
const loans = entities.list<Loan>('loan')
const loanPayments = entities.list<LoanPayment>('loanPayment')
const cards = entities.list<CreditCard>('creditCard')
const cardTxns = entities.list<CreditCardTransaction>('creditCardTransaction')
const cashAdv = entities.list<CashAdvanceAccount>('cashAdvanceAccount')
const cashAdvTxns = entities.list<CashAdvanceTransaction>('cashAdvanceTransaction')
const installAdv = entities.list<InstallmentCashAdvance>('installmentCashAdvance')
const installAdvPayments = entities.list<InstallmentCashAdvancePayment>(
  'installmentCashAdvancePayment',
)
const loading = entities.loading('bank')

const localCurrency = computed(
  () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
)

const drawerOpen = ref(false)
const editing = ref<Bank | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  const loads: Array<[EntityType, () => Promise<unknown>]> = [
    ['bank', () => entities.load<Bank>('bank')],
    ['account', () => entities.load<Account>('account')],
    ['loan', () => entities.load<Loan>('loan')],
    ['loanPayment', () => entities.load<LoanPayment>('loanPayment')],
    ['creditCard', () => entities.load<CreditCard>('creditCard')],
    ['creditCardTransaction', () => entities.load<CreditCardTransaction>('creditCardTransaction')],
    ['cashAdvanceAccount', () => entities.load<CashAdvanceAccount>('cashAdvanceAccount')],
    ['cashAdvanceTransaction', () => entities.load<CashAdvanceTransaction>('cashAdvanceTransaction')],
    [
      'installmentCashAdvance',
      () => entities.load<InstallmentCashAdvance>('installmentCashAdvance'),
    ],
    [
      'installmentCashAdvancePayment',
      () => entities.load<InstallmentCashAdvancePayment>('installmentCashAdvancePayment'),
    ],
  ]
  for (const [key, load] of loads) {
    if (!entities.loaded(key).value) tasks.push(load().catch(() => undefined))
  }
  if (tasks.length) await Promise.all(tasks)
})

const debtByBank = computed(() =>
  debtTotalsByBankId({
    loans: loans.value,
    loanPayments: loanPayments.value,
    creditCards: cards.value,
    creditCardTransactions: cardTxns.value,
    cashAdvanceAccounts: cashAdv.value,
    cashAdvanceTransactions: cashAdvTxns.value,
    installmentAdvances: installAdv.value,
    installmentAdvancePayments: installAdvPayments.value,
    localCurrency: localCurrency.value,
  }),
)

function bankDebtTotal(bankId: string): string {
  return debtByBank.value.get(bankId) ?? '0'
}

const usedBankIds = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const a of accounts.value) if (a.bankId) set.add(a.bankId)
  for (const l of loans.value) if (l.bankId) set.add(l.bankId)
  for (const c of cards.value) if (c.bankId) set.add(c.bankId)
  for (const a of cashAdv.value) if (a.bankId) set.add(a.bankId)
  for (const a of installAdv.value) if (a.bankId) set.add(a.bankId)
  return set
})

const filters = computed<ListFilter<Bank>[]>(() => [
  {
    kind: 'select',
    key: 'usage',
    label: 'Durum',
    placeholder: 'Tüm bankalar',
    options: [
      { value: 'used', label: 'Kullanımda' },
      { value: 'unused', label: 'Kullanılmıyor' },
    ],
    getValue: (bank) => (usedBankIds.value.has(bank.id) ? 'used' : 'unused'),
  },
  {
    kind: 'numberRange',
    key: 'totalDebt',
    label: 'Toplam borç',
    numberKind: 'currency',
    getValue: (bank) => Number(bankDebtTotal(bank.id)),
  },
])

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openEdit(bank: Bank): void {
  editing.value = bank
  drawerOpen.value = true
}

async function remove(bank: Bank): Promise<void> {
  try {
    await entities.remove('bank', bank.id)
    message.success('Banka silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

const columns = computed<TableColumnType<Bank>[]>(() => [
  adminPrimaryNameColumn<Bank>('Ad'),
  {
    key: 'shortName',
    title: 'Kısa ad',
    dataIndex: 'shortName',
    sorter: (a, b) => compareOptionalString(a.shortName, b.shortName),
  },
  {
    key: 'totalDebt',
    title: 'Toplam borç',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(bankDebtTotal((record as Bank).id), localCurrency.value),
    sorter: (a, b) => compareNumeric(a, b, (bank) => Number(bankDebtTotal(bank.id))),
  },
  {
    key: 'bicSwift',
    title: 'BIC',
    dataIndex: 'bicSwift',
    sorter: (a, b) => compareOptionalString(a.bicSwift, b.bicSwift),
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
      :items="banks"
      state-key="banks"
      search-placeholder="Banka ara…"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['name', 'shortName', 'bicSwift']"
      create-label="Yeni banka"
      empty-text="Henüz banka eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <BankFormDrawer v-model:open="drawerOpen" :bank="editing" />
  </div>
</template>
