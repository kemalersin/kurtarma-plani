<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import {
  Form,
  FormItem,
  Textarea,
  Button,
  Space,
  Switch,
  message,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import KpFormLabel from '@/components/KpFormLabel.vue'
import KpStatRow from '@/components/KpStatRow.vue'
import { disableAfter } from '@/core/util/datepicker'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import LocaleDatePicker from '@/components/LocaleDatePicker.vue'
import PaymentSourcePicker from '@/components/PaymentSourcePicker.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import type { ScheduleRow } from '@/finance/loan'
import { computeLateFee, lateDays } from '@/finance/loan'
import { D } from '@/finance/decimal'
import { isInstallmentUpcoming, canMarkInstallmentAsPaid, displayInstallmentDueAmount } from './installmentDisplay'
import {
  advancePaidThroughIndex,
  indexAdvancePayments,
  installmentAdvanceLateFeeRates,
} from './installmentAdvanceHelpers'
import {
  buildInstallmentPaymentStats,
  installmentAmountHint,
  installmentPaymentDateHint,
  installmentPaymentSourceTooltip,
} from './installmentPaymentFormHints'

interface Props {
  open: boolean
  advance: InstallmentCashAdvance | null
  row: ScheduleRow | null
  existing: InstallmentCashAdvancePayment | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const allPayments = entities.list<InstallmentCashAdvancePayment>(
  'installmentCashAdvancePayment',
)
const { formatCurrency, formatDate } = useLocaleFormatters()

/**
 * Sıralı amortizasyon invariant'ı: Sonraki taksit ödemeleri varken bu ödeme
 * silinemez ve tutarı plan taksitine kilitlenir — kalan anapara hesabı
 * tutarlı kalsın diye. Tarih ise sonraki ödemenin tarihine kadar ileri
 * alınabilir (bugünden ileri de olabilir). Bkz. PaymentMarkDrawer (kredi).
 */
const laterOwnPayments = computed(() => {
  if (!props.advance || !props.row) return []
  return allPayments.value.filter(
    (p) =>
      p.installmentAdvanceId === props.advance!.id &&
      p.installmentIndex > props.row!.index &&
      !!p.paidDate,
  )
})

const hasLaterPayments = computed<boolean>(() => laterOwnPayments.value.length > 0)

/** Sonraki taksit ödemesi varken silinemez — düğme gösterilmez. */
const canUnmarkPayment = computed(
  () => !!props.existing?.paidDate && !hasLaterPayments.value,
)

const nextPaymentDate = computed<string | undefined>(() => {
  if (!laterOwnPayments.value.length) return undefined
  return laterOwnPayments.value
    .map((p) => p.paidDate!)
    .sort()[0]
})

const disabledPaymentDate = computed(() => disableAfter(nextPaymentDate.value))

interface Form {
  paidDate: Dayjs | undefined
  paidAmount: number
  sourceAccountId: string | undefined
  sourceCashRegisterId: string | undefined
  notes: string
}

const draft = reactive<Form>({
  paidDate: undefined,
  paidAmount: 0,
  sourceAccountId: undefined,
  sourceCashRegisterId: undefined,
  notes: '',
})
const saving = ref(false)
const markAsPaid = ref(false)

const isUpcoming = computed(() =>
  props.row ? isInstallmentUpcoming(props.row.dueDate) : false,
)

const advanceOwnPayments = computed(() => {
  if (!props.advance) return []
  return allPayments.value.filter((p) => p.installmentAdvanceId === props.advance!.id)
})

const paidThrough = computed(() => advancePaidThroughIndex(advanceOwnPayments.value))

const paymentMap = computed(() => indexAdvancePayments(advanceOwnPayments.value))

function paymentDueAmount(asOf?: Dayjs): string {
  if (!props.advance || !props.row) return '0'
  const asOfIso = (asOf ?? draft.paidDate ?? dayjs()).toISOString()
  return displayInstallmentDueAmount(
    props.row.installment,
    props.row.dueDate,
    asOfIso,
    installmentAdvanceLateFeeRates(props.advance),
    paymentMap.value.get(props.row.index),
  )
}

const canMarkAsPaid = computed(() =>
  props.row ? canMarkInstallmentAsPaid(props.row.index, paidThrough.value) : false,
)

const showPaidToggle = computed(() => canMarkAsPaid.value && !props.existing?.paidDate)

const lateFee = computed<string>(() => {
  if (!props.advance || !props.row || !draft.paidDate) return '0'
  const days = lateDays(props.row.dueDate, draft.paidDate.toISOString())
  if (days <= 0) return '0'
  return computeLateFee(
    props.row.installment,
    days,
    { value: props.advance.interestRate, period: props.advance.interestPeriod },
    props.advance.lateInterestRate != null && props.advance.lateInterestPeriod
      ? {
          value: props.advance.lateInterestRate,
          period: props.advance.lateInterestPeriod,
        }
      : undefined,
  )
})

const totalDue = computed<string>(() => {
  if (!props.row) return '0'
  if (markAsPaid.value) return paymentDueAmount()
  return D(props.row.installment).plus(lateFee.value).toDecimalPlaces(2).toString()
})

const lateDaysCount = computed<number>(() => {
  if (!props.row || !draft.paidDate) return 0
  return lateDays(props.row.dueDate, draft.paidDate.toISOString())
})

function formatMoney(value: string | number): string {
  return formatCurrency(value, props.advance?.currency)
}

const profileCurrency = computed(
  () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
)

const paymentSourceTooltip = computed(() =>
  installmentPaymentSourceTooltip(profileCurrency.value),
)

const paymentDateHint = computed(() =>
  nextPaymentDate.value
    ? installmentPaymentDateHint(formatDate(nextPaymentDate.value))
    : undefined,
)

const amountHint = computed(() =>
  installmentAmountHint({
    markAsPaid: markAsPaid.value,
    hasLaterPayments: hasLaterPayments.value,
    hasLateFee: lateDaysCount.value > 0,
  }),
)

const statItems = computed(() =>
  buildInstallmentPaymentStats({
    dueDateLabel: props.row ? formatDate(props.row.dueDate) : '—',
    planInstallmentLabel: props.row ? formatMoney(props.row.installment) : '—',
    markAsPaid: markAsPaid.value,
    lateDaysCount: lateDaysCount.value,
    lateFeeLabel: formatMoney(lateFee.value),
    totalDueLabel: formatMoney(totalDue.value),
  }),
)

watch(
  () => [props.open, props.row?.index, props.existing?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.existing?.paidDate) {
      markAsPaid.value = true
      draft.paidDate = dayjs(props.existing.paidDate)
      draft.paidAmount = hasLaterPayments.value
        ? Number(props.row?.installment ?? 0)
        : (props.existing.paidAmount ?? Number(props.row?.installment ?? 0))
      draft.sourceAccountId = props.existing.sourceAccountId
      draft.sourceCashRegisterId = props.existing.sourceCashRegisterId
      draft.notes = props.existing.notes ?? ''
    } else if (props.existing) {
      markAsPaid.value = false
      draft.paidDate = undefined
      draft.paidAmount =
        props.existing.scheduledAmount ?? Number(props.row?.installment ?? 0)
      draft.sourceAccountId = props.existing.sourceAccountId
      draft.sourceCashRegisterId = props.existing.sourceCashRegisterId
      draft.notes = props.existing.notes ?? ''
    } else {
      markAsPaid.value =
        canMarkAsPaid.value && props.row
          ? !isInstallmentUpcoming(props.row.dueDate)
          : false
      draft.paidDate = markAsPaid.value ? dayjs() : undefined
      draft.paidAmount = hasLaterPayments.value
        ? Number(props.row?.installment ?? 0)
        : Number(
            markAsPaid.value ? paymentDueAmount(dayjs()) : props.row?.installment ?? 0,
          )
      draft.sourceAccountId = undefined
      draft.sourceCashRegisterId = undefined
      draft.notes = ''
    }
  },
)

watch(markAsPaid, (paid) => {
  if (!props.open) return
  if (!canMarkAsPaid.value && !props.existing?.paidDate) {
    markAsPaid.value = false
    return
  }
  if (paid && !draft.paidDate) {
    draft.paidDate = dayjs()
  }
  if (!paid) {
    draft.paidDate = undefined
    draft.sourceAccountId = undefined
    draft.sourceCashRegisterId = undefined
  }
})

watch(
  () => draft.paidDate,
  () => {
    if (!props.row || !markAsPaid.value) return
    draft.paidAmount = hasLaterPayments.value
      ? Number(props.row.installment)
      : Number(totalDue.value)
  },
)

async function submit(): Promise<void> {
  if (!props.advance || !props.row) return

  if (!markAsPaid.value) {
    saving.value = true
    try {
      await entities.save<InstallmentCashAdvancePayment>(
        'installmentCashAdvancePayment',
        {
          id: props.existing?.id,
          installmentAdvanceId: props.advance.id,
          installmentIndex: props.row.index,
          dueDate: props.row.dueDate,
          scheduledAmount: Number(draft.paidAmount),
          notes: draft.notes.trim() || undefined,
        },
      )
      message.success('Taksit tutarı güncellendi.')
      emit('saved')
      emit('update:open', false)
    } catch (error) {
      console.error(error)
      message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
    } finally {
      saving.value = false
    }
    return
  }

  if (!draft.paidDate) {
    message.error('Ödeme tarihi gerekli.')
    return
  }
  const finalAmount = hasLaterPayments.value
    ? Number(props.row.installment)
    : Number(draft.paidAmount)
  saving.value = true
  try {
    await entities.save<InstallmentCashAdvancePayment>(
      'installmentCashAdvancePayment',
      {
        id: props.existing?.id,
        installmentAdvanceId: props.advance.id,
        installmentIndex: props.row.index,
        dueDate: props.row.dueDate,
        scheduledAmount: Number(props.row.installment),
        paidDate: draft.paidDate.toISOString(),
        paidAmount: finalAmount,
        lateFee: Number(lateFee.value),
        sourceAccountId: draft.sourceAccountId,
        sourceCashRegisterId: draft.sourceCashRegisterId,
        notes: draft.notes.trim() || undefined,
      },
    )
    message.success('Ödeme kaydedildi.')
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  } finally {
    saving.value = false
  }
}

async function unmark(): Promise<void> {
  if (!props.existing) {
    emit('update:open', false)
    return
  }
  if (hasLaterPayments.value) {
    message.warning(
      'Önce sonraki taksit ödemelerini kaldırın; ardından bu ödeme silinebilir.',
    )
    return
  }
  saving.value = true
  try {
    await entities.remove('installmentCashAdvancePayment', props.existing.id)
    message.success('Ödeme kaydı kaldırıldı.')
    emit('saved')
    emit('update:open', false)
  } catch {
    message.error('Kaldırılamadı.')
  } finally {
    saving.value = false
  }
}

function close(): void {
  emit('update:open', false)
}
</script>

<template>
  <FormDrawer
    stack-id="installment-advance-payment"
    :open="open"
    :title="
      row
        ? markAsPaid || !isUpcoming
          ? `Taksit #${row.index} ödemesi`
          : `Taksit #${row.index} — tutar`
        : 'Taksit'
    "
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <KpStatRow :columns="statItems.length" :items="statItems" />

      <Form layout="vertical" :colon="false" @submit.prevent="submit">
        <FormItem v-if="showPaidToggle" label="Ödendi olarak işaretle">
          <Switch v-model:checked="markAsPaid" />
        </FormItem>
        <FormItem v-if="markAsPaid" required>
          <template #label>
            <KpFormLabel :hint="paymentDateHint">Ödeme tarihi</KpFormLabel>
          </template>
          <LocaleDatePicker
            v-model:value="draft.paidDate"
            :disabled-date="disabledPaymentDate"
            style="width: 100%"
          />
        </FormItem>
        <FormItem>
          <template #label>
            <KpFormLabel :hint="amountHint">
              {{ markAsPaid ? 'Ödenen tutar' : 'Taksit tutarı' }}
            </KpFormLabel>
          </template>
          <LocaleInputNumber
            v-model:value="draft.paidAmount"
            kind="currency"
            :min="0"
            :disabled="hasLaterPayments"
          />
        </FormItem>
        <PaymentSourcePicker
          v-if="markAsPaid"
          v-model:accountId="draft.sourceAccountId"
          v-model:cashRegisterId="draft.sourceCashRegisterId"
          :label-tooltip="paymentSourceTooltip"
        />
        <FormItem label="Notlar">
          <Textarea v-model:value="draft.notes" :rows="2" />
        </FormItem>
      </Form>

      <div v-if="canUnmarkPayment" class="kp-form-drawer-danger-row">
        <Button
          :loading="saving"
          danger
          ghost
          size="small"
          @click="unmark"
        >
          Ödemeyi kaldır
        </Button>
      </div>
    </Space>

    <template #actions>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>
</template>
