<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Button,
  Empty,
  message,
  Tag,
} from 'ant-design-vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import DrawerDataTable from '@/components/DrawerDataTable.vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import FormDrawer from '@/components/FormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import type { ScheduleRow } from '@/finance/loan'
import { D } from '@/finance/decimal'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  indexAdvancePayments,
  installmentAdvanceLateFeeRates,
  payoffForInstallmentAdvance,
  remainingDebtForInstallmentAdvance,
} from './installmentAdvanceHelpers'
import { buildScheduleDrawerColumns } from './schedule-table-columns'
import type { KpTableColumn } from '@/core/util/table-columns'
import InstallmentAdvancePaymentDrawer from './InstallmentAdvancePaymentDrawer.vue'
import SchedulePayoffDrawer from './SchedulePayoffDrawer.vue'
import { payoffStatTooltip } from './payoffStatTooltip'
import { projectInstallmentRowDueAmount } from './installmentDisplay'

interface Props {
  open: boolean
  advance: InstallmentCashAdvance | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const payments = entities.list<InstallmentCashAdvancePayment>(
  'installmentCashAdvancePayment',
)

const schedule = computed(() => {
  if (!props.advance) return null
  return buildScheduleForInstallmentAdvance(props.advance)
})

const ownPayments = computed<InstallmentCashAdvancePayment[]>(() => {
  if (!props.advance) return []
  return payments.value.filter((p) => p.installmentAdvanceId === props.advance!.id)
})

const paymentMap = computed(() => indexAdvancePayments(ownPayments.value))
const paidIndex = computed(() => advancePaidThroughIndex(ownPayments.value))

const remainingDebt = computed<string>(() => {
  if (!schedule.value || !props.advance) return '0'
  return remainingDebtForInstallmentAdvance(
    props.advance,
    schedule.value,
    paidIndex.value,
    undefined,
    ownPayments.value,
  )
})

const payoff = computed<string>(() => {
  if (!schedule.value || !props.advance) return '0'
  return payoffForInstallmentAdvance(
    props.advance,
    schedule.value,
    paidIndex.value,
    undefined,
    ownPayments.value,
  )
})

const totalPaid = computed<string>(() =>
  ownPayments.value
    .reduce((acc, p) => acc.plus(p.paidAmount ?? 0), D(0))
    .toDecimalPlaces(2)
    .toString(),
)

function formatMoney(value: string | number): string {
  return formatCurrency(value, props.advance?.currency)
}

function installmentDisplay(row: ScheduleRow): string {
  if (!props.advance || !schedule.value) return formatMoney(row.installment)
  return formatMoney(
    projectInstallmentRowDueAmount(
      row,
      schedule.value.rows,
      paidIndex.value,
      new Date().toISOString(),
      installmentAdvanceLateFeeRates(props.advance),
      paymentMap.value,
    ),
  )
}

const canEarlyPayoff = computed(() => {
  if (!schedule.value || !props.advance) return false
  return (
    paidIndex.value < schedule.value.rows.length && Number(payoff.value) > 0
  )
})

const isClosed = computed(() => {
  const total = schedule.value?.rows.length ?? 0
  return total > 0 && paidIndex.value >= total
})

const stats = computed<KpStat[]>(() => {
  const payoffStat: KpStat = {
    label: 'Erken kapama (bugün)',
    value: formatMoney(payoff.value),
  }
  if (!isClosed.value) {
    payoffStat.labelTooltip = payoffStatTooltip(props.advance?.earlyPayoffWithoutInterest)
  }

  return [
    {
      label: 'Kalan borç',
      value: formatMoney(remainingDebt.value),
      tone: 'primary',
    },
    payoffStat,
    { label: 'Toplam ödenen', value: formatMoney(totalPaid.value), tone: 'success' },
    {
      label: 'Ödenen taksit',
      value: `${paidIndex.value} / ${schedule.value?.rows.length ?? 0}`,
    },
  ]
})

type RowStatus = 'paid' | 'late' | 'due' | 'upcoming'

function statusFor(row: ScheduleRow): RowStatus {
  const payment = paymentMap.value.get(row.index)
  if (payment?.paidDate) return 'paid'
  const today = new Date()
  const due = parseISO(row.dueDate)
  const days = differenceInCalendarDays(due, today)
  if (days < 0) return 'late'
  if (days <= 7) return 'due'
  return 'upcoming'
}

const STATUS_LABELS: Record<RowStatus, string> = {
  paid: 'Ödendi',
  late: 'Gecikmiş',
  due: 'Yaklaşan',
  upcoming: 'İleride',
}
const STATUS_COLORS: Record<RowStatus, string> = {
  paid: 'green',
  late: 'red',
  due: 'orange',
  upcoming: 'default',
}

const columns = computed(() => {
  const base = buildScheduleDrawerColumns(formatDate, formatMoney)
  return base.map((col) => {
    const key = String(col.key ?? '')
    if (key === 'installment') {
      return {
        ...col,
        customRender: ({ record }: { record: ScheduleRow }) => installmentDisplay(record),
        kpDisplay: (row: ScheduleRow) => installmentDisplay(row),
      }
    }
    if (key === 'status') {
      return {
        ...col,
        kpDisplay: (row: ScheduleRow) => STATUS_LABELS[statusFor(row)],
        kpTag: (row: ScheduleRow) => {
          const status = statusFor(row)
          return { color: STATUS_COLORS[status], label: STATUS_LABELS[status] }
        },
      } satisfies KpTableColumn<ScheduleRow>
    }
    return col
  })
})

const markOpen = ref(false)
const payoffOpen = ref(false)
const activeRow = ref<ScheduleRow | null>(null)
const activeExisting = ref<InstallmentCashAdvancePayment | null>(null)

function openMark(row: ScheduleRow): void {
  activeRow.value = row
  activeExisting.value = paymentMap.value.get(row.index) ?? null
  markOpen.value = true
}

function canDeletePayment(row: ScheduleRow): boolean {
  const payment = paymentMap.value.get(row.index)
  if (!payment) return false
  if (!payment.paidDate) return true
  return !ownPayments.value.some(
    (p) => p.installmentIndex > row.index && !!p.paidDate,
  )
}

async function onDeletePayment(row: ScheduleRow): Promise<void> {
  const payment = paymentMap.value.get(row.index)
  if (!payment) return
  if (payment.paidDate && !canDeletePayment(row)) {
    message.warning(
      'Önce sonraki taksit ödemelerini kaldırın; ardından bu ödeme silinebilir.',
    )
    return
  }
  try {
    await entities.remove('installmentCashAdvancePayment', payment.id)
    message.success('Ödeme kaydı kaldırıldı.')
  } catch {
    message.error('Kaldırılamadı.')
  }
}

function scheduleRowProps(row: ScheduleRow): Record<string, unknown> {
  return {
    class: 'kp-schedule-row--clickable',
    onClick: () => openMark(row),
  }
}
</script>

<template>
  <FormDrawer
    stack-id="installment-advance-schedule"
    :open="open"
    :title="advance ? `${advance.name} — taksit planı` : 'Taksit planı'"
    width="min(960px, 100vw)"
    mobile-actions-in-footer
    @update:open="emit('update:open', $event)"
  >
    <template #actions>
      <Button v-if="advance && canEarlyPayoff" type="primary" @click="payoffOpen = true">
        Erken kapama
      </Button>
      <Tag v-else-if="advance && isClosed" color="success">Kapandı</Tag>
    </template>
    <div v-if="!advance">
      <Empty />
    </div>
    <div v-else class="kp-drawer-table-page">
      <DismissibleDrawerAlert
        hint-key="installment-advance-schedule.info"
        message="Bilgi"
        :description="
          advance.earlyPayoffWithoutInterest
            ? 'Bu avans erken kapamada faiz uygulamıyor; tahmini tutar kalan anapara + biriken gecikme faizidir.'
            : 'Erken kapama tahmini: kalan anapara + kısmi dönem faizi + biriken gecikme faizi (banka sözleşmesi farklı uygulayabilir).'
        "
      />

      <KpStatRow :items="stats" />

      <DrawerDataTable
        :data-source="schedule?.rows ?? []"
        :columns="columns"
        :row-key="(row: ScheduleRow) => row.index"
        row-actions
        delete-title="Bu ödeme kaydı silinsin mi?"
        :can-delete="canDeletePayment"
        :custom-row="scheduleRowProps"
        @edit="openMark"
        @delete="onDeletePayment"
      />
    </div>
  </FormDrawer>

  <InstallmentAdvancePaymentDrawer
    v-model:open="markOpen"
    :advance="advance"
    :row="activeRow"
    :existing="activeExisting"
  />

  <SchedulePayoffDrawer v-model:open="payoffOpen" :advance="advance" />
</template>

