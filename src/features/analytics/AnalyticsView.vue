<script setup lang="ts">
import { Tabs, TabPane, Spin } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import DebtAnalysisTab from '@/features/analytics/DebtAnalysisTab.vue'
import CashflowAnalysisTab from '@/features/analytics/CashflowAnalysisTab.vue'
import AccountHistoryTab from '@/features/analytics/AccountHistoryTab.vue'
import { useRoutedTabs } from '@/composables/useRoutedTabs'
import { useAnalyticsFilters } from '@/composables/useAnalyticsFilters'
import { useAnalyticsData } from '@/features/analytics/useAnalyticsData'

const ANALYTICS_TABS = ['debts', 'cashflow', 'accounts'] as const
const { activeTab } = useRoutedTabs(ANALYTICS_TABS, 'debts', { routeName: 'analytics' })

const filterState = useAnalyticsFilters()
const { data, loading } = useAnalyticsData(filterState.filters)
</script>

<template>
  <div class="kp-analytics kp-tabs-page">
    <div v-if="loading" class="kp-page-spinner">
      <Spin size="large" />
    </div>

    <template v-else>
      <PageHeader
        class="kp-analytics__header"
        tabbed
        title="Analiz & rapor"
        subtitle="Borç vadeleri, nakit akışı ve hesap hareketleri — filtreler liste araç çubuğundaki düğmeden."
      />

      <Tabs v-model:activeKey="activeTab" type="line" class="kp-analytics-tabs">
        <TabPane key="debts" tab="Borç analizi">
          <DebtAnalysisTab :data="data" :filters="filterState" />
        </TabPane>
        <TabPane key="cashflow" tab="Nakit akışı">
          <CashflowAnalysisTab :data="data" :filters="filterState" />
        </TabPane>
        <TabPane key="accounts" tab="Hesap geçmişi">
          <AccountHistoryTab :data="data" :filters="filterState" />
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
  flex-shrink: 0;
}

.kp-analytics-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
}
</style>
