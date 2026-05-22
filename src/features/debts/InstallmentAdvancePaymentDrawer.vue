<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import {
  Form,
  FormItem,
  DatePicker,
  Textarea,
  Button,
  Space,
  Alert,
  message,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import KpStatRow from '@/components/KpStatRow.vue'
import KpTooltip from '@/components/KpTooltip.vue'
import { disableAfter } from '@/core/util/datepicker'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import PaymentSourcePicker from '@/components/PaymentSourcePicker.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import type { ScheduleRow } from '@/finance/loan'
import { computeLateFee, lateDays } from '@/finance/loan'
import { D } from '@/finance/decimal'

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
  return D(props.row.installment).plus(lateFee.value).toDecimalPlaces(2).toString()
})

const lateDaysCount = computed<number>(() => {
  if (!props.row || !draft.paidDate) return 0
  return lateDays(props.row.dueDate, draft.paidDate.toISOString())
})

function formatMoney(value: string | number): string {
  return formatCurrency(value, props.advance?.currency)
}

watch(
  () => [props.open, props.row?.index, props.existing?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.existing?.paidDate) {
      draft.paidDate = dayjs(props.existing.paidDate)
      // Sonraki ödemeler varsa tutar plan taksitine kilitlenir.
      draft.paidAmount = hasLaterPayments.value
        ? Number(props.row?.installment ?? 0)
        : (props.existing.paidAmount ?? Number(props.row?.installment ?? 0))
      draft.sourceAccountId = props.existing.sourceAccountId
      draft.sourceCashRegisterId = props.existing.sourceCashRegisterId
      draft.notes = props.existing.notes ?? ''
    } else {
      draft.paidDate = dayjs()
      draft.paidAmount = Number(props.row?.installment ?? 0)
      draft.sourceAccountId = undefined
      draft.sourceCashRegisterId = undefined
      draft.notes = ''
    }
  },
)

watch(
  () => draft.paidDate,
  () => {
    if (!props.row) return
    draft.paidAmount = hasLaterPayments.value
      ? Number(props.row.installment)
      : Number(totalDue.value)
  },
)

async function submit(): Promise<void> {
  if (!props.advance || !props.row) return
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
    :title="row ? `Taksit #${row.index} ödemesi` : 'Taksit ödemesi'"
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <KpStatRow
        :min-column-width="100"
        :items="[
          { label: 'Vade', value: row ? formatDate(row.dueDate) : '—' },
          { label: 'Plan taksit', value: row ? formatMoney(row.installment) : '—', tone: 'primary' },
          { label: 'Gecikme', value: `${lateDaysCount} gün`, tone: lateDaysCount > 0 ? 'danger' : 'default' },
        ]"
      />

      <Form layout="vertical" :colon="false" @submit.prevent="submit">
        <FormItem
          label="Ödeme tarihi"
          required
          :extra="
            nextPaymentDate
              ? `Sonraki ödeme ${formatDate(nextPaymentDate)} — bu tarihe kadar ileri alınabilir.`
              : undefined
          "
        >
          <DatePicker
            v-model:value="draft.paidDate"
            :disabled-date="disabledPaymentDate"
            style="width: 100%"
          />
        </FormItem>
        <FormItem
          label="Ödenen tutar"
          :extra="
            hasLaterPayments
              ? 'Sonraki taksit ödemeleri olduğu için tutar plan taksitine eşitlenir.'
              : undefined
          "
        >
          <LocaleInputNumber
            v-model:value="draft.paidAmount"
            kind="currency"
            :min="0"
            :disabled="hasLaterPayments"
          />
        </FormItem>
        <PaymentSourcePicker
          v-model:accountId="draft.sourceAccountId"
          v-model:cashRegisterId="draft.sourceCashRegisterId"
          hint="Boş bırakılırsa cashflow bakiyesinden düşmez."
        />
        <FormItem label="Notlar">
          <Textarea v-model:value="draft.notes" :rows="2" />
        </FormItem>
      </Form>

      <Alert
        v-if="lateDaysCount > 0"
        type="warning"
        show-icon
        :message="`Gecikme faizi: ${formatMoney(lateFee)}`"
        :description="`Önerilen toplam: ${formatMoney(totalDue)}`"
      />

      <div v-if="existing" class="kp-form-drawer-danger-row">
        <KpTooltip
          :title="
            hasLaterPayments
              ? 'Sonraki taksitler ödenmiş olduğu için bu ödeme silinemez. Önce sonraki taksit ödemelerini kaldırın.'
              : 'Bu ödeme kaydını sil'
          "
        >
          <span>
            <Button
              :loading="saving"
              :disabled="hasLaterPayments"
              danger
              ghost
              size="small"
              @click="unmark"
            >
              Ödemeyi kaldır
            </Button>
          </span>
        </KpTooltip>
      </div>
    </Space>

    <template #extra>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>
</template>
