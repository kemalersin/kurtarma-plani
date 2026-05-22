<script setup lang="ts">
import { computed } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { Space, Select, DatePicker, Button } from 'ant-design-vue'
import { FilterOutlined, ClearOutlined } from '@ant-design/icons-vue'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'

const props = defineProps<{
  filters: AnalyticsFilterState
  data: AnalyticsData
  showCategory?: boolean
  showEndpoint?: boolean
}>()

const rangeValue = computed<[Dayjs, Dayjs]>(() => [
  dayjs(props.filters.range.value.from),
  dayjs(props.filters.range.value.to),
])

function onRangeChange(dates: [Dayjs, Dayjs] | [Dayjs, Dayjs] | null): void {
  if (!dates?.[0] || !dates[1]) return
  props.filters.patch({
    from: dates[0].format('YYYY-MM-DD'),
    to: dates[1].format('YYYY-MM-DD'),
  })
}

const bankOptions = computed(() =>
  props.data.banks.map((b) => ({ value: b.id, label: b.name })),
)

const endpointOptions = computed(() => {
  const accounts = props.data.accounts.map((a) => ({
    value: `acc:${a.id}`,
    label: a.name,
    group: 'Hesaplar',
  }))
  const registers = props.data.registers.map((r) => ({
    value: `reg:${r.id}`,
    label: r.name,
    group: 'Kasalar',
  }))
  return [...accounts, ...registers]
})

const categoryOptions = computed(() => {
  const income = props.data.categories
    .filter((c) => c.group === 'income')
    .map((c) => ({ value: c.value, label: c.label }))
  const expense = props.data.categories
    .filter((c) => c.group === 'expense')
    .map((c) => ({ value: c.value, label: c.label }))
  return [
    { label: 'Gelir türleri', options: income },
    { label: 'Gider türleri', options: expense },
  ].filter((g) => g.options.length > 0)
})

const activeFilterCount = computed(() => {
  let n = 0
  if (props.filters.bankId.value) n++
  if (props.filters.endpointId.value) n++
  if (props.filters.categoryId.value) n++
  return n
})
</script>

<template>
  <div class="kp-analytics-filters">
    <Space wrap :size="12" align="center">
      <DatePicker.RangePicker
        :value="rangeValue"
        format="DD.MM.YYYY"
        :allow-clear="false"
        @update:value="(v: unknown) => onRangeChange(v as [Dayjs, Dayjs] | null)"
      />
      <Select
        :value="filters.bankId.value || undefined"
        placeholder="Banka"
        allow-clear
        show-search
        option-filter-prop="label"
        style="min-width: 160px"
        :options="bankOptions"
        @update:value="(v) => (filters.bankId.value = String(v ?? ''))"
      />
      <Select
        v-if="showEndpoint !== false"
        :value="filters.endpointId.value || undefined"
        placeholder="Hesap / kasa"
        allow-clear
        show-search
        option-filter-prop="label"
        style="min-width: 180px"
        :options="endpointOptions"
        @update:value="(v) => (filters.endpointId.value = String(v ?? ''))"
      />
      <Select
        v-if="showCategory"
        :value="filters.categoryId.value || undefined"
        placeholder="Kategori"
        allow-clear
        show-search
        option-filter-prop="label"
        style="min-width: 160px"
        :options="categoryOptions"
        @update:value="(v) => (filters.categoryId.value = String(v ?? ''))"
      />
      <Button v-if="activeFilterCount > 0" type="link" size="small" @click="filters.reset()">
        <template #icon><ClearOutlined /></template>
        Filtreleri temizle
      </Button>
      <span v-if="activeFilterCount > 0" class="kp-analytics-filters__badge">
        <FilterOutlined />
        {{ activeFilterCount }} filtre
      </span>
    </Space>
  </div>
</template>

<style scoped>
.kp-analytics-filters {
  margin-bottom: 16px;
}

.kp-analytics-filters__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ant-color-primary);
}
</style>
