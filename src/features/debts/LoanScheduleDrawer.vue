<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Tag,
  Empty,
  Alert,
  message,
} from 'ant-design-vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import DrawerDataTable from '@/components/DrawerDataTable.vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import FormDrawer from '@/components/FormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { Loan, LoanPayment } from '@/core/types/entities'
import type { ScheduleRow } from '@/finance/loan'
import { D } from '@/finance/decimal'
import { buildScheduleForLoan, indexPayments, paidThroughIndex } from './loanHelpers'
import { buildScheduleDrawerColumns } from './schedule-table-columns'
import { payoffAmount } from '@/finance/loan'
import PaymentMarkDrawer from './PaymentMarkDrawer.vue'

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

const remainingPrincipal = computed<string>(() => {
  if (!schedule.value) return '0'
  const idx = paidIndex.value
  if (idx >= schedule.value.rows.length) return '0'
  if (idx === 0) return schedule.value.rows[0]!.beginningBalance
  return schedule.value.rows[idx - 1]!.endingBalance
})

const payoff = computed<string>(() => {
  if (!schedule.value) return '0'
  return payoffAmount({
    schedule: schedule.value,
    paidThroughIndex: paidIndex.value,
    asOfDate: new Date().toISOString(),
  })
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

const stats = computed<KpStat[]>(() => [
  {
    label: 'Kalan anapara',
    value: formatMoney(remainingPrincipal.value),
    tone: 'primary',
  },
  { label: 'Erken kapama (bugün)', value: formatMoney(payoff.value) },
  { label: 'Toplam ödenen', value: formatMoney(totalPaid.value), tone: 'success' },
  {
    label: 'Ödenen taksit',
    value: `${paidIndex.value} / ${schedule.value?.rows.length ?? 0}`,
  },
])

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

const columns = computed(() => buildScheduleDrawerColumns(formatDate, formatMoney))

const markOpen = ref(false)
const activeRow = ref<ScheduleRow | null>(null)
const activeExisting = ref<LoanPayment | null>(null)

function openMark(row: ScheduleRow): void {
  activeRow.value = row
  activeExisting.value = paymentMap.value.get(row.index) ?? null
  markOpen.value = true
}

function canDeletePayment(row: ScheduleRow): boolean {
  const payment = paymentMap.value.get(row.index)
  if (!payment?.paidDate) return false
  return !loanPayments.value.some(
    (p) => p.installmentIndex > row.index && !!p.paidDate,
  )
}

async function onDeletePayment(row: ScheduleRow): Promise<void> {
  const payment = paymentMap.value.get(row.index)
  if (!payment?.paidDate) return
  if (!canDeletePayment(row)) {
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
    <div v-if="!loan">
      <Empty />
    </div>
    <div v-else class="kp-drawer-table-page">
      <Alert
        type="info"
        show-icon
        message="Bilgi"
        description="Vade gecikmesinde gecikme faizi günlük olarak hesaplanır. Erken kapama tutarı, plan üzerindeki kalan anaparaya kısmi ay faizinin eklenmesiyle bulunur (banka sözleşmesi farklı uygulayabilir)."
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
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="STATUS_COLORS[statusFor(record as ScheduleRow)]">
              {{ STATUS_LABELS[statusFor(record as ScheduleRow)] }}
            </Tag>
          </template>
        </template>
      </DrawerDataTable>
    </div>
  </FormDrawer>

  <PaymentMarkDrawer
    v-model:open="markOpen"
    :loan="loan"
    :row="activeRow"
    :existing="activeExisting"
  />
</template>

