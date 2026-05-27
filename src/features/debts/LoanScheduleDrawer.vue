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
import type { Loan, LoanPayment } from '@/core/types/entities'
import type { ScheduleRow } from '@/finance/loan'
import { D } from '@/finance/decimal'
import { buildScheduleForLoan, indexPayments, loanLateFeeRates, paidThroughIndex, payoffForLoan, remainingDebtForLoan } from './loanHelpers'
import { buildScheduleDrawerColumns } from './schedule-table-columns'
import type { KpTableColumn } from '@/core/util/table-columns'
import { payoffStatTooltip } from './payoffStatTooltip'
import { projectInstallmentRowDueAmount } from './installmentDisplay'
import PaymentMarkDrawer from './PaymentMarkDrawer.vue'
import SchedulePayoffDrawer from './SchedulePayoffDrawer.vue'

interface Props {
  open: boolean
  loan: Loan | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const payments = entities.list<LoanPayment>('loanPayment')

const schedule = computed(() => {
  if (!props.loan) return null
  return buildScheduleForLoan(props.loan)
})

const loanPayments = computed<LoanPayment[]>(() => {
  if (!props.loan) return []
  return payments.value.filter((p) => p.loanId === props.loan!.id)
})

const paymentMap = computed(() => indexPayments(loanPayments.value))

const paidIndex = computed(() => paidThroughIndex(loanPayments.value))

const remainingDebt = computed<string>(() => {
  if (!schedule.value || !props.loan) return '0'
  return remainingDebtForLoan(props.loan, schedule.value, paidIndex.value, undefined, loanPayments.value)
})

const payoff = computed<string>(() => {
  if (!schedule.value || !props.loan) return '0'
  return payoffForLoan(props.loan, schedule.value, paidIndex.value, undefined, loanPayments.value)
})

const totalPaid = computed<string>(() =>
  loanPayments.value
    .reduce((acc, p) => acc.plus(p.paidAmount ?? 0), D(0))
    .toDecimalPlaces(2)
    .toString(),
)

function formatMoney(value: string | number): string {
  return formatCurrency(value, props.loan?.currency)
}

function installmentDisplay(row: ScheduleRow): string {
  if (!props.loan || !schedule.value) return formatMoney(row.installment)
  return formatMoney(
    projectInstallmentRowDueAmount(
      row,
      schedule.value.rows,
      paidIndex.value,
      new Date().toISOString(),
      loanLateFeeRates(props.loan),
      paymentMap.value,
    ),
  )
}

const canEarlyPayoff = computed(() => {
  if (!schedule.value || !props.loan) return false
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
    payoffStat.labelTooltip = payoffStatTooltip()
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
const activeExisting = ref<LoanPayment | null>(null)

function openMark(row: ScheduleRow): void {
  activeRow.value = row
  activeExisting.value = paymentMap.value.get(row.index) ?? null
  markOpen.value = true
}

function canDeletePayment(row: ScheduleRow): boolean {
  const payment = paymentMap.value.get(row.index)
  if (!payment) return false
  if (!payment.paidDate) return true
  return !loanPayments.value.some(
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
    await entities.remove('loanPayment', payment.id)
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
    stack-id="loan-schedule"
    :open="open"
    :title="loan ? `${loan.name} — taksit planı` : 'Taksit planı'"
    width="min(960px, 100vw)"
    @update:open="emit('update:open', $event)"
  >
    <template #actions>
      <Button
        v-if="loan && canEarlyPayoff"
        type="primary"
        class="kp-drawer-footer-action--block"
        @click="payoffOpen = true"
      >
        Erken kapama
      </Button>
      <Tag v-else-if="loan && isClosed" color="success">Kapandı</Tag>
    </template>
    <div v-if="!loan">
      <Empty />
    </div>
    <div v-else class="kp-drawer-table-page">
      <DismissibleDrawerAlert
        hint-key="loan-schedule.info"
        message="Bilgi"
        description="Vade gecikmesinde gecikme faizi günlük olarak hesaplanır. Erken kapama tahmini: kalan anapara + kısmi dönem faizi + biriken gecikme faizi (banka sözleşmesi ve komisyon farklı uygulayabilir)."
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

  <PaymentMarkDrawer
    v-model:open="markOpen"
    :loan="loan"
    :row="activeRow"
    :existing="activeExisting"
  />

  <SchedulePayoffDrawer v-model:open="payoffOpen" :loan="loan" />
</template>

