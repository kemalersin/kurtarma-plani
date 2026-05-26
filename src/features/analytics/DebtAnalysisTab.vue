<script setup lang="ts">
import { computed } from 'vue'
import { Card, Space, Switch } from 'ant-design-vue'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import KpChart from '@/components/KpChart.vue'
import DebtInstallmentList from '@/features/analytics/DebtInstallmentList.vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'

const props = defineProps<{
  data: AnalyticsData
  filters: AnalyticsFilterState
}>()

const { formatCurrency, formatNumber } = useLocaleFormatters()
const currency = computed(() => props.data.localCurrency)

const minPaymentDue = computed({
  get: () => props.filters.cardDueMode.value === 'min',
  set: (on: boolean) => {
    props.filters.cardDueMode.value = on ? 'min' : 'statement'
  },
})

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${m}.${y!.slice(2)}`
}

function currencyAxisFormatter(value: number | string): string {
  return formatNumber(Number(value), {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

const chartOption = computed<EChartsOption>(() => {
  const d = props.data.debtSeries
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) => formatCurrency(Number(v), currency.value),
    },
    legend: { data: ['Ödenen', 'Bekleyen'], bottom: 0 },
    grid: { left: 56, right: 16, top: 16, bottom: 48 },
    xAxis: {
      type: 'category',
      data: d.months.map(monthLabel),
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: currencyAxisFormatter },
    },
    series: [
      {
        name: 'Ödenen',
        type: 'bar',
        stack: 'debt',
        data: d.paid,
        itemStyle: { color: '#52c41a' },
      },
      {
        name: 'Bekleyen',
        type: 'bar',
        stack: 'debt',
        data: d.pending,
        itemStyle: { color: '#fa8c16' },
      },
    ],
  }
})

const isChartEmpty = computed(
  () =>
    props.data.debtSeries.paid.every((v) => v === 0) &&
    props.data.debtSeries.pending.every((v) => v === 0),
)
</script>

<template>
  <div class="kp-analytics-tab">
    <Card size="small" class="kp-analytics-tab__chart-card">
      <template #title>Aylık borç vadeleri</template>
      <template #extra>
        <Space :size="12" align="center" wrap>
          <label class="kp-analytics-debt-min-toggle">
            <Switch v-model:checked="minPaymentDue" size="small" />
            <span>Asgari ödeme</span>
          </label>
        </Space>
      </template>
      <KpChart :option="chartOption" :height="280" :is-empty="isChartEmpty" />
    </Card>
    <Card title="Taksit listesi" size="small" class="kp-analytics-tab__table-card">
      <DebtInstallmentList
        :rows="data.debtRows"
        :currency="currency"
        :filters="filters"
        :banks="data.banks"
      />
    </Card>
  </div>
</template>

<style scoped>
.kp-analytics-debt-min-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--ant-color-text);
  user-select: none;
}
</style>
