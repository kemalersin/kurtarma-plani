<script setup lang="ts">
import { Tabs, TabPane } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import LoansTab from '@/features/debts/LoansTab.vue'
import CreditCardsTab from '@/features/debts/CreditCardsTab.vue'
import CashAdvanceTab from '@/features/debts/CashAdvanceTab.vue'
import InstallmentAdvancesTab from '@/features/debts/InstallmentAdvancesTab.vue'
import { useRoutedTabs } from '@/composables/useRoutedTabs'

const DEBTS_TABS = ['loans', 'creditCards', 'cashAdvance', 'installmentAdvance'] as const
const { activeTab } = useRoutedTabs(DEBTS_TABS, 'loans')
</script>

<template>
  <div class="kp-debts">
    <PageHeader
      class="kp-debts__header"
      title="Borçlar"
      subtitle="Krediler, kredi kartları, nakit avans ve taksitli nakit avans."
    />

    <Tabs v-model:activeKey="activeTab" type="line" class="kp-debts-tabs">
      <TabPane key="loans" tab="Krediler">
        <LoansTab />
      </TabPane>
      <TabPane key="creditCards" tab="Kredi kartları">
        <CreditCardsTab />
      </TabPane>
      <TabPane key="cashAdvance" tab="Nakit avans">
        <CashAdvanceTab />
      </TabPane>
      <TabPane key="installmentAdvance" tab="Taksitli nakit avans">
        <InstallmentAdvancesTab />
      </TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.kp-debts {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.kp-debts__header {
  flex-shrink: 0;
}

.kp-debts-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-debts-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.kp-debts-tabs :deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
}

.kp-debts-tabs :deep(.ant-tabs-content) {
  height: 100%;
}

.kp-debts-tabs :deep(.ant-tabs-tabpane) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
