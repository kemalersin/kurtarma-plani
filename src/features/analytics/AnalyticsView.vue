<script setup lang="ts">
import { computed } from 'vue'
import { Tabs, TabPane, Spin } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import AnalyticsFilterBar from '@/features/analytics/AnalyticsFilterBar.vue'
import DebtAnalysisTab from '@/features/analytics/DebtAnalysisTab.vue'
import CashflowAnalysisTab from '@/features/analytics/CashflowAnalysisTab.vue'
import AccountHistoryTab from '@/features/analytics/AccountHistoryTab.vue'
import { useRoutedTabs } from '@/composables/useRoutedTabs'
import { useAnalyticsFilters } from '@/composables/useAnalyticsFilters'
import { useAnalyticsData } from '@/features/analytics/useAnalyticsData'

const ANALYTICS_TABS = ['debts', 'cashflow', 'accounts'] as const
const { activeTab } = useRoutedTabs(ANALYTICS_TABS, 'debts')

const filterState = useAnalyticsFilters()
const { data, loading } = useAnalyticsData(filterState.filters)

const showCategory = computed(() => activeTab.value === 'cashflow')
const showEndpoint = computed(() => activeTab.value !== 'debts')
</script>

<template>
  <div class="kp-analytics">
    <div v-if="loading" class="kp-page-spinner">
      <Spin size="large" />
    </div>

    <template v-else>
      <PageHeader
        class="kp-analytics__header"
        title="Analiz & rapor"
        subtitle="Borç vadeleri, nakit akışı ve hesap hareketleri — filtreler URL'de saklanır."
      />

      <AnalyticsFilterBar
        :filters="filterState"
        :data="data"
        :show-category="showCategory"
        :show-endpoint="showEndpoint"
      />

      <Tabs v-model:activeKey="activeTab" type="line" class="kp-analytics-tabs">
        <TabPane key="debts" tab="Borç analizi">
          <DebtAnalysisTab :data="data" />
        </TabPane>
        <TabPane key="cashflow" tab="Nakit akışı">
          <CashflowAnalysisTab :data="data" />
        </TabPane>
        <TabPane key="accounts" tab="Hesap geçmişi">
          <AccountHistoryTab :data="data" />
        </TabPane>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
.kp-analytics {
  width: 100%;
}

.kp-analytics__header {
  margin-bottom: 16px;
}

.kp-analytics-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
}
</style>
