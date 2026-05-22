<script setup lang="ts">
import { computed, h } from 'vue'
import { Card, Table } from 'ant-design-vue'
import type { ColumnsType } from 'ant-design-vue/es/table'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import KpChart from '@/components/KpChart.vue'
import AnalyticsFilterBar from '@/features/analytics/AnalyticsFilterBar.vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'
import type { MovementRow } from '@/features/analytics/reports'

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

const columns: ColumnsType<MovementRow> = [
  {
    title: 'Tarih',
    dataIndex: 'date',
    key: 'date',
    width: 120,
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
    customRender: ({ text }) => formatDate(String(text)),
  },
  {
    title: 'Hesap / kasa',
    dataIndex: 'endpointName',
    key: 'endpointName',
    sorter: (a, b) => a.endpointName.localeCompare(b.endpointName, 'tr'),
  },
  {
    title: 'Kaynak',
    dataIndex: 'sourceLabel',
    key: 'sourceLabel',
    width: 160,
    filters: [
      { text: 'Gelir', value: 'Gelir' },
      { text: 'Gider', value: 'Gider' },
      { text: 'Transfer', value: 'Transfer' },
    ],
    onFilter: (value, record) => record.sourceLabel === value,
  },
  {
    title: 'Tutar',
    dataIndex: 'amount',
    key: 'amount',
    width: 140,
    align: 'right',
    sorter: (a, b) => a.amount - b.amount,
    customRender: ({ text }) => {
      const val = Number(text)
      const cls = val < 0 ? 'kp-balance kp-balance--negative' : 'kp-balance kp-balance--positive'
      return h('span', { class: cls }, formatCurrency(val, currency.value))
    },
  },
]

const isTrendEmpty = computed(() => props.data.assetTrend.values.every((v) => v === 0))
</script>

<template>
  <div class="kp-analytics-tab">
    <Card title="Bakiye trendi" size="small" class="kp-analytics-tab__chart-card">
      <KpChart :option="trendOption" :height="280" :is-empty="isTrendEmpty" />
    </Card>
    <Card title="Hareket listesi" size="small" class="kp-analytics-tab__table-card">
      <template #extra>
        <AnalyticsFilterBar :filters="filters" :data="data" :show-category="false" />
      </template>
      <Table
        :columns="columns"
        :data-source="data.movementRows"
        row-key="id"
        size="small"
        :pagination="{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }"
        :scroll="{ x: 640 }"
        :show-sorter-tooltip="false"
      />
    </Card>
  </div>
</template>

<style scoped>
.kp-analytics-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kp-balance--negative {
  color: var(--ant-color-error);
}

.kp-balance--positive {
  color: var(--ant-color-success);
}
</style>
