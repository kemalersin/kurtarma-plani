<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import BankFormDrawer from '@/features/admin/BankFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import type {
  Account,
  Bank,
  CashAdvanceAccount,
  CreditCard,
  InstallmentCashAdvance,
  Loan,
} from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'

const entities = useEntitiesStore()
const banks = entities.list<Bank>('bank')
const accounts = entities.list<Account>('account')
const loans = entities.list<Loan>('loan')
const cards = entities.list<CreditCard>('creditCard')
const cashAdv = entities.list<CashAdvanceAccount>('cashAdvanceAccount')
const installAdv = entities.list<InstallmentCashAdvance>('installmentCashAdvance')
const loading = entities.loading('bank')

const drawerOpen = ref(false)
const editing = ref<Bank | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('bank').value)
    tasks.push(entities.load<Bank>('bank').catch(() => undefined))
  if (!entities.loaded('account').value)
    tasks.push(entities.load<Account>('account').catch(() => undefined))
  if (!entities.loaded('loan').value)
    tasks.push(entities.load<Loan>('loan').catch(() => undefined))
  if (!entities.loaded('creditCard').value)
    tasks.push(entities.load<CreditCard>('creditCard').catch(() => undefined))
  if (!entities.loaded('cashAdvanceAccount').value)
    tasks.push(entities.load<CashAdvanceAccount>('cashAdvanceAccount').catch(() => undefined))
  if (!entities.loaded('installmentCashAdvance').value)
    tasks.push(
      entities.load<InstallmentCashAdvance>('installmentCashAdvance').catch(() => undefined),
    )
  if (tasks.length) await Promise.all(tasks)
})

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
  },
  {
    key: 'bicSwift',
    title: 'BIC',
    dataIndex: 'bicSwift',
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
