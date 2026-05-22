<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import AccountFormDrawer from '@/features/admin/AccountFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useAccountBalances } from '@/features/cashflow/useAccountBalances'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { Account, Bank } from '@/core/types/entities'
import { AccountTypes } from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()
const accounts = entities.list<Account>('account')
const banks = entities.list<Bank>('bank')
const loading = entities.loading('account')
const { balancesByAccount } = useAccountBalances()

function currentBalance(account: Account): number {
  const raw = balancesByAccount.value[account.id]
  return raw == null ? account.openingBalance : Number(raw)
}

const drawerOpen = ref(false)
const editing = ref<Account | null>(null)

onMounted(async () => {
  await Promise.all([
    entities.loaded('account').value ? Promise.resolve() : entities.load<Account>('account').catch(() => undefined),
    entities.loaded('bank').value ? Promise.resolve() : entities.load<Bank>('bank').catch(() => undefined),
  ])
})

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openEdit(account: Account): void {
  editing.value = account
  drawerOpen.value = true
}

async function remove(account: Account): Promise<void> {
  try {
    await entities.remove('account', account.id)
    message.success('Hesap silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function bankName(id: string): string {
  return banks.value.find((b) => b.id === id)?.name ?? '—'
}

const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  checking: 'Vadesiz',
  savings: 'Vadeli',
  fx: 'Döviz',
  other: 'Diğer',
}

const filters = computed<ListFilter<Account>[]>(() => [
  {
    kind: 'select',
    key: 'type',
    label: 'Tür',
    placeholder: 'Tüm türler',
    options: AccountTypes.map((value) => ({ value, label: ACCOUNT_TYPE_LABELS[value] })),
    getValue: (account) => account.type,
  },
  {
    kind: 'numberRange',
    key: 'opening',
    label: 'Açılış bakiyesi',
    numberKind: 'currency',
    getValue: (account) => account.openingBalance,
  },
  {
    kind: 'numberRange',
    key: 'currentBalance',
    label: 'Güncel bakiye',
    numberKind: 'currency',
    getValue: (account) => currentBalance(account),
  },
  {
    kind: 'dateRange',
    key: 'opened',
    label: 'Açılış tarihi',
    getValue: (account) => account.openingDate,
  },
])

function formatBalance(amount: number, currency: string): string {
  return formatCurrency(amount, currency)
}

const columns = computed<TableColumnType<Account>[]>(() => [
  adminPrimaryNameColumn<Account>('Hesap'),
  {
    key: 'bank',
    title: 'Banka',
    customRender: ({ record }) => bankName((record as Account).bankId),
    sorter: (a, b) => bankName(a.bankId).localeCompare(bankName(b.bankId), 'tr'),
  },
  {
    key: 'type',
    title: 'Tür',
    customRender: ({ record }) => ACCOUNT_TYPE_LABELS[(record as Account).type],
  },
  {
    key: 'currency',
    title: 'Para',
    dataIndex: 'currency',
  },
  {
    key: 'openingBalance',
    title: 'Açılış bakiyesi',
    align: 'right',
    kpDisplay: (account: Account) => formatBalance(account.openingBalance, account.currency),
    customRender: ({ record }) =>
      formatBalance((record as Account).openingBalance, (record as Account).currency),
    sorter: (a, b) => a.openingBalance - b.openingBalance,
  },
  {
    key: 'currentBalance',
    title: 'Güncel bakiye',
    align: 'right',
    kpDisplay: (account: Account) => formatBalance(currentBalance(account), account.currency),
    customRender: ({ record }) => {
      const account = record as Account
      const value = currentBalance(account)
      const text = formatBalance(value, account.currency)
      const cls = value < 0 ? 'kp-balance kp-balance--negative' : 'kp-balance'
      return h('span', { class: cls }, text)
    },
    sorter: (a, b) => currentBalance(a) - currentBalance(b),
  },
  {
    key: 'openingDate',
    title: 'Açılış tarihi',
    customRender: ({ record }) => formatDate((record as Account).openingDate),
    sorter: (a, b) => a.openingDate.localeCompare(b.openingDate),
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
      :items="accounts"
      state-key="accounts"
      search-placeholder="Hesap ara…"
      :loading="loading"
      :columns="columns"
      bank-filter
      :banks="banks"
      :filters="filters"
      :search-keys="['name', 'iban']"
      create-label="Yeni hesap"
      empty-text="Henüz hesap eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <AccountFormDrawer v-model:open="drawerOpen" :account="editing" />
  </div>
</template>
