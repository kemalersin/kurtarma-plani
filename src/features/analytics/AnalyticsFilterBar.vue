<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { Popover, Badge, Button, Select, DatePicker } from 'ant-design-vue'
import { FilterOutlined } from '@ant-design/icons-vue'
import type { AnalyticsFilterState } from '@/composables/useAnalyticsFilters'
import type { AnalyticsData } from '@/features/analytics/useAnalyticsData'
import {
  buildBankGroupedAccountOptions,
  filterBankGroupedAccountOption,
} from '@/features/admin/accountSelectOptions'

const props = defineProps<{
  filters: AnalyticsFilterState
  data: AnalyticsData
  showCategory?: boolean
  showEndpoint?: boolean
}>()

const open = ref(false)

const rangeValue = computed<[Dayjs, Dayjs]>(() => [
  dayjs(props.filters.range.value.from),
  dayjs(props.filters.range.value.to),
])

function onRangeChange(dates: [Dayjs, Dayjs] | null): void {
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
  const accountGroups = buildBankGroupedAccountOptions(
    props.data.accounts,
    props.data.banks,
  ).map((group) => ({
    label: group.label,
    options: group.options.map((opt) => ({
      value: `acc:${opt.value}`,
      label: opt.label,
      bankName: opt.bankName,
    })),
  }))
  const registerGroup = {
    label: 'Kasalar',
    options: props.data.registers.map((r) => ({
      value: `reg:${r.id}`,
      label: r.name,
    })),
  }
  return registerGroup.options.length > 0
    ? [...accountGroups, registerGroup]
    : accountGroups
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
  if (props.showEndpoint !== false && props.filters.endpointId.value) n++
  if (props.showCategory && props.filters.categoryId.value) n++
  return n
})

function clearFilters(): void {
  props.filters.reset()
}
</script>

<template>
  <Popover
    v-model:open="open"
    trigger="click"
    placement="bottomRight"
    overlay-class-name="kp-list-filter-popover"
    :destroy-tooltip-on-hide="false"
  >
    <template #content>
      <div class="kp-list-filter">
        <header class="kp-list-filter__head">Filtreler</header>

        <div class="kp-list-filter__field">
          <label class="kp-list-filter__label">Tarih aralığı</label>
          <DatePicker.RangePicker
            :value="rangeValue"
            class="kp-list-filter__control"
            format="DD.MM.YYYY"
            :allow-clear="false"
            @update:value="(v: unknown) => onRangeChange(v as [Dayjs, Dayjs] | null)"
          />
        </div>

        <div class="kp-list-filter__field">
          <label class="kp-list-filter__label">Banka</label>
          <Select
            :value="filters.bankId.value || undefined"
            class="kp-list-filter__control"
            placeholder="Tüm bankalar"
            allow-clear
            show-search
            option-filter-prop="label"
            :options="bankOptions"
            @update:value="(v) => (filters.bankId.value = String(v ?? ''))"
          />
        </div>

        <div v-if="showEndpoint !== false" class="kp-list-filter__field">
          <label class="kp-list-filter__label">Hesap / kasa</label>
          <Select
            :value="filters.endpointId.value || undefined"
            class="kp-list-filter__control"
            placeholder="Tümü"
            allow-clear
            show-search
            :filter-option="filterBankGroupedAccountOption"
            :options="endpointOptions"
            @update:value="(v) => (filters.endpointId.value = String(v ?? ''))"
          />
        </div>

        <div v-if="showCategory" class="kp-list-filter__field">
          <label class="kp-list-filter__label">Kategori</label>
          <Select
            :value="filters.categoryId.value || undefined"
            class="kp-list-filter__control"
            placeholder="Tümü"
            allow-clear
            show-search
            option-filter-prop="label"
            :options="categoryOptions"
            @update:value="(v) => (filters.categoryId.value = String(v ?? ''))"
          />
        </div>

        <footer class="kp-list-filter__foot">
          <Button block :disabled="activeFilterCount === 0" @click="clearFilters">
            Filtreyi temizle
          </Button>
        </footer>
      </div>
    </template>

    <Badge :count="activeFilterCount" :show-zero="false" :offset="[-2, 2]" size="small">
      <Button
        :type="activeFilterCount > 0 ? 'primary' : 'default'"
        :ghost="activeFilterCount > 0"
        aria-label="Filtreler"
      >
        <template #icon><FilterOutlined /></template>
      </Button>
    </Badge>
  </Popover>
</template>
