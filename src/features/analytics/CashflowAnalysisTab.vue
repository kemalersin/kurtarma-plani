<script setup lang="ts">
import { computed, h } from 'vue'
import { Card, Table, Row, Col } from 'ant-design-vue'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import KpChart from '@/components/KpChart.vue'
import AnalyticsFilterBar from '@/features/analytics/AnalyticsFilterBar.vue'
import { buildDonutOption } from '@/features/analytics/chartOptions'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { prepareListTableColumns, TABLE_SCROLL_X } from '@/core/util/table-columns'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'
import type { CashflowMonthRow } from '@/features/analytics/reports'

const props = defineProps<{
  data: AnalyticsData
  filters: AnalyticsFilterState
}>()

const { formatCurrency, formatNumber } = useLocaleFormatters()
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

const cashflowOption = computed<EChartsOption>(() => {
  const d = props.data.cashflowSeries
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) => formatCurrency(Number(v), currency.value),
    },
    legend: { data: ['Gelir', 'Gider', 'Net'], bottom: 0 },
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
      { name: 'Gelir', type: 'bar', data: d.income, itemStyle: { color: '#52c41a' } },
      { name: 'Gider', type: 'bar', data: d.expense, itemStyle: { color: '#ff4d4f' } },
      {
        name: 'Net',
        type: 'line',
        data: d.net,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: '#1677ff' },
        lineStyle: { width: 2 },
      },
    ],
  }
})

const incomeDonut = computed(() =>
  buildDonutOption(
    props.data.incomeCategories,
    (v) => formatCurrency(v, currency.value),
  ),
)

const expenseDonut = computed(() =>
  buildDonutOption(
    props.data.expenseCategories,
    (v) => formatCurrency(v, currency.value),
  ),
)

const tableColumns = prepareListTableColumns<CashflowMonthRow>([
  {
    title: 'Ay',
    dataIndex: 'month',
    key: 'month',
    customRender: ({ text }) => monthLabel(String(text)),
    sorter: (a, b) => a.month.localeCompare(b.month),
  },
  {
    title: 'Gelir',
    dataIndex: 'income',
    key: 'income',
    align: 'right',
    sorter: (a, b) => Number(a.income) - Number(b.income),
    customRender: ({ text }) => formatCurrency(String(text), currency.value),
  },
  {
    title: 'Gider',
    dataIndex: 'expense',
    key: 'expense',
    align: 'right',
    sorter: (a, b) => Number(a.expense) - Number(b.expense),
    customRender: ({ text }) => formatCurrency(String(text), currency.value),
  },
  {
    title: 'Net',
    dataIndex: 'net',
    key: 'net',
    align: 'right',
    sorter: (a, b) => Number(a.net) - Number(b.net),
    customRender: ({ text }) => {
      const val = String(text)
      const cls = Number(val) < 0 ? 'kp-balance kp-balance--negative' : 'kp-balance'
      return h('span', { class: cls }, formatCurrency(val, currency.value))
    },
  },
])

const isCashflowEmpty = computed(
  () =>
    props.data.cashflowSeries.income.every((v) => v === 0) &&
    props.data.cashflowSeries.expense.every((v) => v === 0),
)
</script>

<template>
  <div class="kp-analytics-tab">
    <Card title="Aylık nakit akışı" size="small" class="kp-analytics-tab__chart-card">
      <KpChart :option="cashflowOption" :height="280" :is-empty="isCashflowEmpty" />
    </Card>

    <Row :gutter="[16, 16]">
      <Col :xs="24" :md="12">
        <Card title="Gelir dağılımı" size="small">
          <KpChart
            :option="incomeDonut"
            :height="240"
            :is-empty="data.incomeCategories.length === 0"
          />
        </Card>
      </Col>
      <Col :xs="24" :md="12">
        <Card title="Gider dağılımı" size="small">
          <KpChart
            :option="expenseDonut"
            :height="240"
            :is-empty="data.expenseCategories.length === 0"
          />
        </Card>
      </Col>
    </Row>

    <Card title="Aylık özet tablosu" size="small" class="kp-analytics-tab__table-card">
      <template #extra>
        <AnalyticsFilterBar :filters="filters" :data="data" show-category />
      </template>
      <Table
        :columns="tableColumns"
        :data-source="data.cashflowRows"
        row-key="month"
        size="small"
        table-layout="auto"
        :scroll="{ x: TABLE_SCROLL_X }"
        :pagination="{ pageSize: 12, showSizeChanger: true }"
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
</style>
