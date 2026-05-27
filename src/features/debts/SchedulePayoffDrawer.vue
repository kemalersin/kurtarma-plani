<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import {
  Form,
  FormItem,
  Textarea,
  Button,
  Space,
  message,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
import KpFormLabel from '@/components/KpFormLabel.vue'
import KpStatRow from '@/components/KpStatRow.vue'
import { useProfileStore } from '@/stores/profile'
import { disableFutureDates } from '@/core/util/datepicker'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import LocaleDatePicker from '@/components/LocaleDatePicker.vue'
import PaymentSourcePicker from '@/components/PaymentSourcePicker.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import { buildEarlyPayoffPayments } from './earlyPayoffApply'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  indexAdvancePayments,
  payoffForInstallmentAdvance,
} from './installmentAdvanceHelpers'
import {
  buildScheduleForLoan,
  indexPayments,
  paidThroughIndex,
  payoffForLoan,
} from './loanHelpers'
import { payoffStatTooltip } from './payoffStatTooltip'

interface Props {
  open: boolean
  loan?: Loan | null
  advance?: InstallmentCashAdvance | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const loanPayments = entities.list<LoanPayment>('loanPayment')
const advancePayments = entities.list<InstallmentCashAdvancePayment>(
  'installmentCashAdvancePayment',
)
const { formatCurrency } = useLocaleFormatters()

const isLoan = computed(() => !!props.loan)
const currency = computed(() => props.loan?.currency ?? props.advance?.currency)

const schedule = computed(() => {
  if (props.loan) return buildScheduleForLoan(props.loan)
  if (props.advance) return buildScheduleForInstallmentAdvance(props.advance)
  return null
})

const ownLoanPayments = computed(() => {
  if (!props.loan) return []
  return loanPayments.value.filter((p) => p.loanId === props.loan!.id)
})

const ownAdvancePayments = computed(() => {
  if (!props.advance) return []
  return advancePayments.value.filter(
    (p) => p.installmentAdvanceId === props.advance!.id,
  )
})

const loanPaymentMap = computed(() => indexPayments(ownLoanPayments.value))
const advancePaymentMap = computed(() => indexAdvancePayments(ownAdvancePayments.value))

const loanPaidIndex = computed(() => paidThroughIndex(ownLoanPayments.value))
const advancePaidIndex = computed(() => advancePaidThroughIndex(ownAdvancePayments.value))

const paidIndex = computed(() =>
  props.loan ? loanPaidIndex.value : advancePaidIndex.value,
)

const remainingCount = computed(() => {
  if (!schedule.value) return 0
  return schedule.value.rows.length - paidIndex.value
})

const payoff = computed(() => {
  if (!schedule.value) return '0'
  const asOf = draft.paidDate?.toISOString() ?? new Date().toISOString()
  if (props.loan) {
    return payoffForLoan(
      props.loan,
      schedule.value,
      loanPaidIndex.value,
      asOf,
      ownLoanPayments.value,
    )
  }
  if (props.advance) {
    return payoffForInstallmentAdvance(
      props.advance,
      schedule.value,
      advancePaidIndex.value,
      asOf,
      ownAdvancePayments.value,
    )
  }
  return '0'
})

interface FormDraft {
  paidDate: Dayjs | undefined
  paidAmount: number
  sourceAccountId: string | undefined
  sourceCashRegisterId: string | undefined
  notes: string
}

const draft = reactive<FormDraft>({
  paidDate: undefined,
  paidAmount: 0,
  sourceAccountId: undefined,
  sourceCashRegisterId: undefined,
  notes: '',
})
const saving = ref(false)

function formatMoney(value: string | number): string {
  return formatCurrency(value, currency.value)
}

watch(
  () => [props.open, payoff.value] as const,
  ([open]) => {
    if (!open) return
    draft.paidDate = dayjs()
    draft.paidAmount = Number(payoff.value)
    draft.sourceAccountId = undefined
    draft.sourceCashRegisterId = undefined
    draft.notes = ''
  },
)

watch(
  () => draft.paidDate,
  () => {
    if (!props.open) return
    draft.paidAmount = Number(payoff.value)
  },
)

async function submit(): Promise<void> {
  if (!schedule.value) return
  if (!draft.paidDate) {
    message.error('Ödeme tarihi gerekli.')
    return
  }
  if (remainingCount.value <= 0) {
    message.warning('Kalan taksit yok.')
    return
  }

  const paidDateIso = draft.paidDate.toISOString()
  saving.value = true
  try {
    if (props.loan) {
      const drafts = buildEarlyPayoffPayments({
        schedule: schedule.value,
        paidThroughIndex: loanPaidIndex.value,
        paymentMap: loanPaymentMap.value,
        paidDate: paidDateIso,
        paidAmount: Number(draft.paidAmount),
        sourceAccountId: draft.sourceAccountId,
        sourceCashRegisterId: draft.sourceCashRegisterId,
        notes: draft.notes.trim() || undefined,
      })
      await entities.saveMany<LoanPayment>(
        'loanPayment',
        drafts.map((row) => ({ ...row, loanId: props.loan!.id })),
      )
    } else if (props.advance) {
      const drafts = buildEarlyPayoffPayments({
        schedule: schedule.value,
        paidThroughIndex: advancePaidIndex.value,
        paymentMap: advancePaymentMap.value,
        paidDate: paidDateIso,
        paidAmount: Number(draft.paidAmount),
        sourceAccountId: draft.sourceAccountId,
        sourceCashRegisterId: draft.sourceCashRegisterId,
        notes: draft.notes.trim() || undefined,
      })
      await entities.saveMany<InstallmentCashAdvancePayment>(
        'installmentCashAdvancePayment',
        drafts.map((row) => ({ ...row, installmentAdvanceId: props.advance!.id })),
      )
    }
    message.success('Erken kapama kaydedildi.')
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  } finally {
    saving.value = false
  }
}

function close(): void {
  emit('update:open', false)
}

const stackId = computed(() =>
  isLoan.value ? 'loan-payoff' : 'installment-advance-payoff',
)

const title = computed(() => {
  const name = props.loan?.name ?? props.advance?.name
  return name ? `${name} — erken kapama` : 'Erken kapama'
})

const profileCurrency = computed(
  () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
)

const paidAmountTooltip =
  'Tahmini erken kapama tutarı; banka ekstrenizdeki tutarla farklı olabilir.'

const paymentSourceTooltip = computed(
  () =>
    `Boş bırakılırsa cashflow bakiyesinden düşülmez. Yalnız profil para biriminde (${profileCurrency.value}) tanımlı hesap ve kasalar listelenir. Dövizli hesap/kasalar borç ödemesi için kullanılamaz.`,
)
</script>

<template>
  <FormDrawer
    :stack-id="stackId"
    :open="open"
    :title="title"
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    actions-in-footer
    @update:open="emit('update:open', $event)"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <KpStatRow
        :min-column-width="100"
        :items="[
          {
            label: 'Tahmini tutar',
            value: formatMoney(payoff),
            tone: 'primary',
            labelTooltip: payoffStatTooltip(advance?.earlyPayoffWithoutInterest),
          },
          { label: 'Kalan taksit', value: `${remainingCount} adet` },
        ]"
      />

      <DismissibleDrawerAlert
        hint-key="schedule-payoff.info"
        message="Erken kapama"
        description="Ödenen tutar ilk kalan taksite yazılır; sonraki taksitler sıfır tutarla kapatılır. Banka komisyonu dahil değildir; bağlayıcı tutar için ekstrenize bakın."
      />

      <Form layout="vertical" :colon="false" @submit.prevent="submit">
        <FormItem label="Ödeme tarihi" required>
          <LocaleDatePicker
            v-model:value="draft.paidDate"
            :disabled-date="disableFutureDates"
            style="width: 100%"
          />
        </FormItem>
        <FormItem>
          <template #label>
            <KpFormLabel :hint="paidAmountTooltip">Ödenen tutar</KpFormLabel>
          </template>
          <LocaleInputNumber v-model:value="draft.paidAmount" kind="currency" :min="0" />
        </FormItem>
        <PaymentSourcePicker
          v-model:accountId="draft.sourceAccountId"
          v-model:cashRegisterId="draft.sourceCashRegisterId"
          :label-tooltip="paymentSourceTooltip"
        />
        <FormItem label="Notlar">
          <Textarea v-model:value="draft.notes" :rows="2" placeholder="Erken kapama" />
        </FormItem>
      </Form>
    </Space>

    <template #actions>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Tamam</Button>
      </Space>
    </template>
  </FormDrawer>
</template>
