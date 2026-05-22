<script setup lang="ts">
import { computed, h } from 'vue'
import { Card, Table, Tag } from 'ant-design-vue'
import type { ColumnsType } from 'ant-design-vue/es/table'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import KpChart from '@/components/KpChart.vue'
import AnalyticsFilterBar from '@/features/analytics/AnalyticsFilterBar.vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'
import type { DebtInstallmentRow } from '@/features/analytics/reports'

const props = defineProps<{
  data: AnalyticsData
  filters: AnalyticsFilterState
}>()

const { formatCurrency, formatDate, formatNumber } = useLocaleFormatters()
const currency = computed(() => props.data.localCurrency)

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

const statusTag = (status: DebtInstallmentRow['status']) => {
  if (status === 'paid') return { color: 'success', label: 'Ödendi' }
  if (status === 'overdue') return { color: 'error', label: 'Gecikmiş' }
  return { color: 'processing', label: 'Bekliyor' }
}

const columns: ColumnsType<DebtInstallmentRow> = [
  {
    title: 'Borç',
    dataIndex: 'debtName',
    key: 'debtName',
    sorter: (a, b) => a.debtName.localeCompare(b.debtName, 'tr'),
  },
  {
    title: 'Banka',
    dataIndex: 'bankName',
    key: 'bankName',
    width: 140,
    ellipsis: true,
    sorter: (a, b) => a.bankName.localeCompare(b.bankName, 'tr'),
  },
  {
    title: 'Tür',
    key: 'debtKind',
    width: 120,
    customRender: ({ record }) =>
      record.debtKind === 'loan' ? 'Kredi' : 'Taksitli avans',
  },
  {
    title: 'Taksit',
    dataIndex: 'installmentIndex',
    key: 'installmentIndex',
    width: 72,
    align: 'right',
    sorter: (a, b) => a.installmentIndex - b.installmentIndex,
  },
  {
    title: 'Vade',
    dataIndex: 'dueDate',
    key: 'dueDate',
    width: 120,
    sorter: (a, b) => a.dueDate.localeCompare(b.dueDate),
    customRender: ({ text }) => formatDate(String(text)),
  },
  {
    title: 'Tutar',
    dataIndex: 'amount',
    key: 'amount',
    width: 130,
    align: 'right',
    sorter: (a, b) => Number(a.amount) - Number(b.amount),
    customRender: ({ text }) => formatCurrency(String(text), currency.value),
  },
  {
    title: 'Durum',
    key: 'status',
    width: 110,
    filters: [
      { text: 'Ödendi', value: 'paid' },
      { text: 'Gecikmiş', value: 'overdue' },
      { text: 'Bekliyor', value: 'upcoming' },
    ],
    onFilter: (value, record) => record.status === value,
    customRender: ({ record }) => {
      const t = statusTag(record.status)
      return h(Tag, { color: t.color }, () => t.label)
    },
  },
]

const isChartEmpty = computed(
  () =>
    props.data.debtSeries.paid.every((v) => v === 0) &&
    props.data.debtSeries.pending.every((v) => v === 0),
)
</script>

<template>
  <div class="kp-analytics-tab">
    <Card title="Aylık borç vadeleri" size="small" class="kp-analytics-tab__chart-card">
      <KpChart :option="chartOption" :height="280" :is-empty="isChartEmpty" />
    </Card>
    <Card title="Taksit listesi" size="small" class="kp-analytics-tab__table-card">
      <template #extra>
        <AnalyticsFilterBar
          :filters="filters"
          :data="data"
          :show-endpoint="false"
          :show-category="false"
        />
      </template>
      <Table
        :columns="columns"
        :data-source="data.debtRows"
        row-key="key"
        size="small"
        :pagination="{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['10', '15', '25', '50'] }"
        :scroll="{ x: 860 }"
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

.kp-analytics-tab__chart-card :deep(.ant-card-body) {
  padding-top: 8px;
}
</style>
