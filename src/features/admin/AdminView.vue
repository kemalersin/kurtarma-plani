<script setup lang="ts">
import { Tabs, TabPane } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import BanksTab from '@/features/admin/BanksTab.vue'
import AccountsTab from '@/features/admin/AccountsTab.vue'
import CashRegistersTab from '@/features/admin/CashRegistersTab.vue'
import IncomeTypesTab from '@/features/admin/IncomeTypesTab.vue'
import ExpenseTypesTab from '@/features/admin/ExpenseTypesTab.vue'
import { useRoutedTabs } from '@/composables/useRoutedTabs'

const ADMIN_TABS = [
  'banks',
  'accounts',
  'cashRegisters',
  'incomeTypes',
  'expenseTypes',
] as const

const { activeTab } = useRoutedTabs(ADMIN_TABS, 'banks')
</script>

<template>
  <div class="kp-admin">
    <PageHeader
      class="kp-admin__header"
      title="Yönetim"
      subtitle="Bankalar, hesaplar, kasalar ve gelir/gider türleri."
    />

    <Tabs v-model:activeKey="activeTab" type="line" class="kp-admin-tabs">
      <TabPane key="banks" tab="Bankalar">
        <BanksTab />
      </TabPane>
      <TabPane key="accounts" tab="Hesaplar">
        <AccountsTab />
      </TabPane>
      <TabPane key="cashRegisters" tab="Kasalar">
        <CashRegistersTab />
      </TabPane>
      <TabPane key="incomeTypes" tab="Gelir türleri">
        <IncomeTypesTab />
      </TabPane>
      <TabPane key="expenseTypes" tab="Gider türleri">
        <ExpenseTypesTab />
      </TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.kp-admin {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.kp-admin__header {
  flex-shrink: 0;
}

.kp-admin-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-admin-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.kp-admin-tabs :deep(.ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-admin-tabs :deep(.ant-tabs-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.kp-admin-tabs :deep(.ant-tabs-tabpane) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
