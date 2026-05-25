<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { FileTextOutlined } from '@ant-design/icons-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import CreditCardFormDrawer from './CreditCardFormDrawer.vue'
import CreditCardStatementDrawer from './CreditCardStatementDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { Bank, CreditCard, CreditCardTransaction } from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'
import { compareByDisplayLabel, compareNumeric } from '@/features/debts/debtListSorters'
import { latestCardStatement } from './cardHelpers'

const entities = useEntitiesStore()
const { formatCurrency } = useLocaleFormatters()

const cards = entities.list<CreditCard>('creditCard')
const txns = entities.list<CreditCardTransaction>('creditCardTransaction')
const banks = entities.list<Bank>('bank')
const loading = entities.loading('creditCard')

const formOpen = ref(false)
const statementOpen = ref(false)
const editing = ref<CreditCard | null>(null)
const inspecting = ref<CreditCard | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('creditCard').value)
    tasks.push(entities.load<CreditCard>('creditCard').catch(() => undefined))
  if (!entities.loaded('creditCardTransaction').value)
    tasks.push(
      entities.load<CreditCardTransaction>('creditCardTransaction').catch(() => undefined),
    )
  if (!entities.loaded('bank').value)
    tasks.push(entities.load<Bank>('bank').catch(() => undefined))
  if (tasks.length) await Promise.all(tasks)
})

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}
function openEdit(c: CreditCard): void {
  editing.value = c
  formOpen.value = true
}
function openStatement(c: CreditCard): void {
  inspecting.value = c
  statementOpen.value = true
}
async function remove(c: CreditCard): Promise<void> {
  try {
    await entities.remove('creditCard', c.id)
    const own = txns.value.filter((t) => t.cardId === c.id)
    for (const t of own) await entities.remove('creditCardTransaction', t.id)
    message.success('Kart silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function bankName(id: string): string {
  return banks.value.find((b) => b.id === id)?.name ?? '—'
}

const summaryCache = computed<
  Map<string, { endingBalance: string; minPayment: string; available: number }>
>(() => {
  const map = new Map<
    string,
    { endingBalance: string; minPayment: string; available: number }
  >()
  for (const card of cards.value) {
    const period = latestCardStatement(card, txns.value)
    const endingBalance = period?.statement.endingBalance ?? '0'
    const minPayment = period?.statement.minPayment ?? '0'
    const available = card.limit - Number(endingBalance)
    map.set(card.id, { endingBalance, minPayment, available })
  }
  return map
})

function summary(card: CreditCard) {
  return summaryCache.value.get(card.id) ?? { endingBalance: '0', minPayment: '0', available: card.limit }
}

const filters = computed<ListFilter<CreditCard>[]>(() => [
  {
    kind: 'numberRange',
    key: 'limit',
    label: 'Limit',
    numberKind: 'currency',
    getValue: (card) => card.limit,
  },
  {
    kind: 'numberRange',
    key: 'balance',
    label: 'Borç',
    numberKind: 'currency',
    getValue: (card) => Number(summary(card).endingBalance),
  },
  {
    kind: 'numberRange',
    key: 'available',
    label: 'Kullanılabilir',
    numberKind: 'currency',
    getValue: (card) => summary(card).available,
  },
  {
    kind: 'numberRange',
    key: 'minPayment',
    label: 'Asgari ödeme',
    numberKind: 'currency',
    getValue: (card) => Number(summary(card).minPayment),
  },
])

const columns = computed<TableColumnType<CreditCard>[]>(() => [
  adminPrimaryNameColumn<CreditCard>('Kart'),
  {
    key: 'bank',
    title: 'Banka',
    customRender: ({ record }) => bankName((record as CreditCard).bankId),
    sorter: (a, b) => compareByDisplayLabel(a, b, (card) => bankName(card.bankId)),
  },
  {
    key: 'limit',
    title: 'Limit',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as CreditCard).limit, (record as CreditCard).currency),
    sorter: (a, b) => compareNumeric(a, b, (card) => card.limit),
  },
  {
    key: 'endingBalance',
    title: 'Borç',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(summary(record as CreditCard).endingBalance, (record as CreditCard).currency),
    sorter: (a, b) =>
      compareNumeric(a, b, (card) => Number(summary(card).endingBalance)),
  },
  {
    key: 'available',
    title: 'Kullanılabilir',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(summary(record as CreditCard).available, (record as CreditCard).currency),
    sorter: (a, b) => compareNumeric(a, b, (card) => summary(card).available),
  },
  {
    key: 'minPayment',
    title: 'Asgari',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(summary(record as CreditCard).minPayment, (record as CreditCard).currency),
    sorter: (a, b) =>
      compareNumeric(a, b, (card) => Number(summary(card).minPayment)),
  },
  {
    key: 'archived',
    title: '',
  },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="cards"
      :loading="loading"
      :columns="columns"
      state-key="cards"
      bank-filter
      :banks="banks"
      :filters="filters"
      :search-keys="['name']"
      search-placeholder="Kart ara…"
      create-label="Yeni kart"
      empty-text="Henüz kredi kartı eklenmedi."
      row-action-label="Hesap özeti"
      :row-action-icon="FileTextOutlined"
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
      @row-click="openStatement"
    />

    <CreditCardFormDrawer v-model:open="formOpen" :card="editing" />
    <CreditCardStatementDrawer v-model:open="statementOpen" :card="inspecting" />
  </div>
</template>
