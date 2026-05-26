<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { UnorderedListOutlined } from '@ant-design/icons-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import InstallmentAdvanceFormDrawer from './InstallmentAdvanceFormDrawer.vue'
import InstallmentAdvanceScheduleDrawer from './InstallmentAdvanceScheduleDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  Bank,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'
import type { KpTableColumn } from '@/core/util/table-columns'
import {
  compareByDisplayLabel,
  compareNumeric,
  compareProgressCounts,
  compareIsoDate,
} from '@/features/debts/debtListSorters'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  remainingDebtForInstallmentAdvance,
} from './installmentAdvanceHelpers'
import {
  installmentDebtStatusKey,
  installmentDebtStatusLabel,
  installmentDebtStatusTag,
} from './installmentDebtListStatus'

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const advances = entities.list<InstallmentCashAdvance>('installmentCashAdvance')
const payments = entities.list<InstallmentCashAdvancePayment>(
  'installmentCashAdvancePayment',
)
const banks = entities.list<Bank>('bank')
const loading = computed(
  () =>
    entities.loading('installmentCashAdvance').value ||
    entities.loading('installmentCashAdvancePayment').value ||
    entities.loading('bank').value,
)

const formOpen = ref(false)
const scheduleOpen = ref(false)
const editing = ref<InstallmentCashAdvance | null>(null)
const inspecting = ref<InstallmentCashAdvance | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('installmentCashAdvance').value)
    tasks.push(
      entities.load<InstallmentCashAdvance>('installmentCashAdvance').catch(() => undefined),
    )
  if (!entities.loaded('installmentCashAdvancePayment').value)
    tasks.push(
      entities
        .load<InstallmentCashAdvancePayment>('installmentCashAdvancePayment')
        .catch(() => undefined),
    )
  if (!entities.loaded('bank').value)
    tasks.push(entities.load<Bank>('bank').catch(() => undefined))
  if (tasks.length) await Promise.all(tasks)
})

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}
function openEdit(a: InstallmentCashAdvance): void {
  editing.value = a
  formOpen.value = true
}
function openSchedule(a: InstallmentCashAdvance): void {
  inspecting.value = a
  scheduleOpen.value = true
}
async function remove(a: InstallmentCashAdvance): Promise<void> {
  try {
    await entities.remove('installmentCashAdvance', a.id)
    const own = payments.value.filter((p) => p.installmentAdvanceId === a.id)
    for (const p of own) await entities.remove('installmentCashAdvancePayment', p.id)
    message.success('Avans silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function bankName(id: string): string {
  return banks.value.find((b) => b.id === id)?.name ?? '—'
}

interface AdvanceSummary {
  installment: string
  remaining: string
  paidCount: number
  totalCount: number
  overdue: number
}

const summaryCache = computed<Map<string, AdvanceSummary>>(() => {
  const map = new Map<string, AdvanceSummary>()
  for (const adv of advances.value) {
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const own = payments.value.filter((p) => p.installmentAdvanceId === adv.id)
    const idx = advancePaidThroughIndex(own)
    const remaining = remainingDebtForInstallmentAdvance(adv, schedule, idx, undefined, own)

    const today = new Date()
    const overdue = schedule.rows.filter((r) => {
      if (r.index <= idx) return false
      return differenceInCalendarDays(today, parseISO(r.dueDate)) > 0
    }).length

    map.set(adv.id, {
      installment: schedule.installment,
      remaining,
      paidCount: idx,
      totalCount: schedule.rows.length,
      overdue,
    })
  }
  return map
})

function summary(adv: InstallmentCashAdvance): AdvanceSummary {
  return (
    summaryCache.value.get(adv.id) ?? {
      installment: '0',
      remaining: '0',
      paidCount: 0,
      totalCount: 0,
      overdue: 0,
    }
  )
}

function statusKey(adv: InstallmentCashAdvance): 'overdue' | 'closed' | 'active' {
  return installmentDebtStatusKey(summary(adv))
}

function statusLabel(adv: InstallmentCashAdvance): string {
  return installmentDebtStatusLabel(summary(adv))
}

function statusTag(adv: InstallmentCashAdvance) {
  return installmentDebtStatusTag(summary(adv))
}

const filters = computed<ListFilter<InstallmentCashAdvance>[]>(() => [
  {
    kind: 'select',
    key: 'status',
    label: 'Durum',
    placeholder: 'Tüm durumlar',
    options: [
      { value: 'active', label: 'Devam ediyor' },
      { value: 'overdue', label: 'Gecikmiş' },
      { value: 'closed', label: 'Kapandı' },
    ],
    getValue: (adv) => statusKey(adv),
  },
  {
    kind: 'numberRange',
    key: 'principal',
    label: 'Anapara',
    numberKind: 'currency',
    getValue: (adv) => adv.principal,
  },
  {
    kind: 'numberRange',
    key: 'installment',
    label: 'Aylık taksit',
    numberKind: 'currency',
    getValue: (adv) => Number(summary(adv).installment),
  },
  {
    kind: 'numberRange',
    key: 'remaining',
    label: 'Kalan borç',
    numberKind: 'currency',
    getValue: (adv) => Number(summary(adv).remaining),
  },
  {
    kind: 'numberRange',
    key: 'term',
    label: 'Vade (ay)',
    numberKind: 'integer',
    getValue: (adv) => adv.termMonths,
  },
  {
    kind: 'dateRange',
    key: 'start',
    label: 'Başlangıç tarihi',
    getValue: (adv) => adv.startDate,
  },
])

const columns = computed<TableColumnType<InstallmentCashAdvance>[]>(() => [
  adminPrimaryNameColumn<InstallmentCashAdvance>('Avans'),
  {
    key: 'bank',
    title: 'Banka',
    customRender: ({ record }) => bankName((record as InstallmentCashAdvance).bankId),
    sorter: (a, b) => compareByDisplayLabel(a, b, (adv) => bankName(adv.bankId)),
  },
  {
    key: 'principal',
    title: 'Anapara',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        (record as InstallmentCashAdvance).principal,
        (record as InstallmentCashAdvance).currency,
      ),
    sorter: (a, b) => compareNumeric(a, b, (adv) => adv.principal),
  },
  {
    key: 'term',
    title: 'Vade',
    align: 'right',
    customRender: ({ record }) => `${(record as InstallmentCashAdvance).termMonths} ay`,
    sorter: (a, b) => compareNumeric(a, b, (adv) => adv.termMonths),
  },
  {
    key: 'startDate',
    title: 'Başlangıç',
    customRender: ({ record }) => formatDate((record as InstallmentCashAdvance).startDate),
    sorter: (a, b) => compareIsoDate(a.startDate, b.startDate),
  },
  {
    key: 'installment',
    title: 'Aylık taksit',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as InstallmentCashAdvance).installment,
        (record as InstallmentCashAdvance).currency,
      ),
    sorter: (a, b) =>
      compareNumeric(a, b, (adv) => Number(summary(adv).installment)),
  },
  {
    key: 'remaining',
    title: 'Kalan borç',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(
        summary(record as InstallmentCashAdvance).remaining,
        (record as InstallmentCashAdvance).currency,
      ),
    sorter: (a, b) => compareNumeric(a, b, (adv) => Number(summary(adv).remaining)),
  },
  {
    key: 'progress',
    title: 'İlerleme',
    customRender: ({ record }) => {
      const s = summary(record as InstallmentCashAdvance)
      return `${s.paidCount} / ${s.totalCount}`
    },
    sorter: (a, b) => compareProgressCounts(summary(a), summary(b)),
  },
  {
    key: 'status',
    title: 'Durum',
    kpDisplay: (adv) => statusLabel(adv),
    kpTag: (adv) => statusTag(adv),
    sorter: (a, b) => compareByDisplayLabel(a, b, statusLabel),
  } satisfies KpTableColumn<InstallmentCashAdvance>,
  { key: 'archived', title: '' },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="advances"
      :loading="loading"
      :columns="columns"
      state-key="installment"
      bank-filter
      :banks="banks"
      :filters="filters"
      :search-keys="['name']"
      search-placeholder="Taksitli avans ara…"
      create-label="Yeni taksitli avans"
      empty-text="Henüz taksitli nakit avans eklenmedi."
      row-action-label="Taksit planı"
      :row-action-icon="UnorderedListOutlined"
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
      @row-click="openSchedule"
    />

    <InstallmentAdvanceFormDrawer v-model:open="formOpen" :advance="editing" />
    <InstallmentAdvanceScheduleDrawer v-model:open="scheduleOpen" :advance="inspecting" />
  </div>
</template>
