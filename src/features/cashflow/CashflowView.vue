<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Tabs, TabPane, Badge } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import IncomesTab from '@/features/cashflow/IncomesTab.vue'
import ExpensesTab from '@/features/cashflow/ExpensesTab.vue'
import TransfersTab from '@/features/cashflow/TransfersTab.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useRoutedTabs } from '@/composables/useRoutedTabs'
import { cashflowStatus } from '@/finance/cashflow'
import type { Expense, Income } from '@/core/types/entities'

const CASHFLOW_TABS = ['incomes', 'expenses', 'transfers'] as const
const { activeTab } = useRoutedTabs(CASHFLOW_TABS, 'incomes', { routeName: 'cashflow' })

const entities = useEntitiesStore()

const incomes = entities.list<Income>('income')
const expenses = entities.list<Expense>('expense')

onMounted(async () => {
  /**
   * Borç ödeme/hareket store'larını da yükle — vade rozeti hesabı yalnız
   * gelir/giderden geliyor ama bakiye hesabı (M7 dashboard ve hesap detayları)
   * tüm gerçekleşmiş ödemeleri görmek zorunda. Yükleme paralel; hata yutulur.
   */
  const tasks: Promise<unknown>[] = []
  for (const type of [
    'income',
    'expense',
    'transfer',
    'loanPayment',
    'creditCardTransaction',
    'cashAdvanceTransaction',
    'installmentCashAdvancePayment',
    'account',
    'cashRegister',
  ] as const) {
    if (!entities.loaded(type).value) {
      tasks.push(entities.load(type).catch(() => undefined))
    }
  }
  if (tasks.length) await Promise.all(tasks)
})

/**
 * Bir kayıt kümesinde vade dikkat sayısı = `overdue` + `due` (yaklaşan 7 gün).
 * Üst sekme başlığında kırmızı rozet → kullanıcıyı işaretlemeye iter.
 */
function attentionCount(items: { plannedDate: string; actualDate?: string; archived?: boolean }[]): number {
  let n = 0
  for (const it of items) {
    if (it.archived) continue
    const s = cashflowStatus(it)
    if (s === 'overdue' || s === 'due') n++
  }
  return n
}

const incomeAttention = computed(() => attentionCount(incomes.value))
const expenseAttention = computed(() => attentionCount(expenses.value))
</script>

<template>
  <div class="kp-cashflow">
    <PageHeader
      class="kp-cashflow__header"
      title="Nakit akışı"
      subtitle="Gelir, gider ve hesap/kasa transferleri."
    />

    <Tabs v-model:activeKey="activeTab" type="line" class="kp-cashflow-tabs">
      <TabPane key="incomes">
        <template #tab>
          <span>Gelirler</span>
          <Badge
            v-if="incomeAttention > 0"
            :count="incomeAttention"
            :number-style="{ marginInlineStart: '8px' }"
            :title="`${incomeAttention} gelir vade dikkat istiyor`"
          />
        </template>
        <IncomesTab />
      </TabPane>
      <TabPane key="expenses">
        <template #tab>
          <span>Giderler</span>
          <Badge
            v-if="expenseAttention > 0"
            :count="expenseAttention"
            :number-style="{ marginInlineStart: '8px' }"
            :title="`${expenseAttention} gider vade dikkat istiyor`"
          />
        </template>
        <ExpensesTab />
      </TabPane>
      <TabPane key="transfers" tab="Transferler">
        <TransfersTab />
      </TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.kp-cashflow {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.kp-cashflow__header {
  flex-shrink: 0;
}

.kp-cashflow-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-cashflow-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.kp-cashflow-tabs :deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-cashflow-tabs :deep(.ant-tabs-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-cashflow-tabs :deep(.ant-tabs-tabpane) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
