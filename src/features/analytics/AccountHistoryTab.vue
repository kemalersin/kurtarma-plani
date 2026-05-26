<script setup lang="ts">
import { computed } from 'vue'
import { Card } from 'ant-design-vue'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import KpChart from '@/components/KpChart.vue'
import MovementList from '@/features/analytics/MovementList.vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'

const props = defineProps<{
  data: AnalyticsData
  filters: AnalyticsFilterState
}>()

const { formatCurrency, formatDate, formatNumber } = useLocaleFormatters()
const currency = computed(() => props.data.localCurrency)

function currencyAxisFormatter(value: number | string): string {
  return formatNumber(Number(value), {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

const trendOption = computed<EChartsOption>(() => {
  const d = props.data.assetTrend
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) => formatCurrency(Number(v), currency.value),
    },
    grid: { left: 56, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: d.dates.map((iso) => formatDate(iso)),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: currencyAxisFormatter },
    },
    series: [
      {
        name: 'Bakiye',
        type: 'line',
        data: d.values,
        smooth: true,
        areaStyle: { opacity: 0.1 },
        itemStyle: { color: '#1677ff' },
        lineStyle: { width: 2 },
      },
    ],
  }
})

const isTrendEmpty = computed(() => props.data.assetTrend.values.every((v) => v === 0))
</script>

<template>
  <div class="kp-analytics-tab">
    <Card title="Bakiye trendi" size="small" class="kp-analytics-tab__chart-card">
      <KpChart :option="trendOption" :height="280" :is-empty="isTrendEmpty" />
    </Card>
    <Card title="Hareket listesi" size="small" class="kp-analytics-tab__table-card">
      <MovementList
        :rows="data.movementRows"
        :currency="currency"
        :filters="filters"
        :data="data"
      />
    </Card>
  </div>
</template>
