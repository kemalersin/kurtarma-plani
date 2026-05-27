<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  Space,
  Button,
  Popconfirm,
  message,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import KpFormLabel from '@/components/KpFormLabel.vue'
import KpSelect from '@/components/KpSelect.vue'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import LocaleDatePicker from '@/components/LocaleDatePicker.vue'
import PaymentSourcePicker from '@/components/PaymentSourcePicker.vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { disableFutureDates, disableOutsideDateRange, combineDisabledDates } from '@/core/util/datepicker'
import type {
  CreditCard,
  CreditCardTransaction,
  CreditCardTxnType,
} from '@/core/types/entities'
import {
  accruedInstallmentCount,
  cardPeriodBounds,
  defaultCardTxnDateInPeriod,
  isCardTxnDateInPeriod,
  type CardPeriod,
  type CardPeriodBounds,
} from './cardHelpers'
import { installmentPaymentSourceTooltip } from './installmentPaymentFormHints'
import {
  resolveCreditCardRepaymentTotal,
  splitInstallmentAmount,
} from '@/finance/credit-card'

interface Props {
  open: boolean
  card: CreditCard | null
  txn?: CreditCardTransaction | null
  /** Hesap özeti drawer'ından yeni kayıt: tarih yalnız bu döneme kısıtlanır. */
  statementPeriod?: CardPeriod | null
}
const props = withDefaults(defineProps<Props>(), { txn: null, statementPeriod: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const profileCurrency = computed(
  () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
)

const paymentSourceTooltip = computed(() =>
  installmentPaymentSourceTooltip(profileCurrency.value),
)

const cashAdvanceTargetTooltip = computed(
  () =>
    `Boş bırakılırsa cashflow bakiyesine eklenmez. Yalnız profil para biriminde (${profileCurrency.value}) tanımlı hesap ve kasalar listelenir. Dövizli hesap/kasalar borç ödemesi için kullanılamaz.`,
)

const typeOptions = computed<{ value: CreditCardTxnType; label: string }[]>(() => [
  { value: 'purchase', label: 'Alışveriş' },
  { value: 'payment', label: 'Ödeme' },
  { value: 'cashAdvance', label: 'Nakit avans' },
])

interface DraftForm {
  date: Dayjs
  type: CreditCardTxnType
  amount: number
  installmentCount: number
  /** Manuel geri ödeme toplamı; undefined = işlem tutarına eşit. */
  repaymentTotal: number | undefined
  sourceAccountId: string | undefined
  sourceCashRegisterId: string | undefined
  targetAccountId: string | undefined
  targetCashRegisterId: string | undefined
  description: string
  notes: string
}

const draft = reactive<DraftForm>({
  date: dayjs(),
  type: 'purchase',
  amount: 0,
  installmentCount: 1,
  repaymentTotal: undefined,
  sourceAccountId: undefined,
  sourceCashRegisterId: undefined,
  targetAccountId: undefined,
  targetCashRegisterId: undefined,
  description: '',
  notes: '',
})
const saving = ref(false)

const createPeriodBounds = computed<CardPeriodBounds | null>(() => {
  if (props.txn || !props.statementPeriod) return null
  return cardPeriodBounds(props.statementPeriod)
})

const createPeriodDateHint = computed(() => {
  const bounds = createPeriodBounds.value
  if (!bounds) return undefined
  const lastDay = new Date(bounds.periodEndExclusiveIso)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  return `Yalnız ${formatDate(bounds.periodStartIso)} – ${formatDate(lastDay.toISOString())} arası (seçili dönem).`
})

const disabledTxnDate = computed(() => {
  const bounds = createPeriodBounds.value
  if (!bounds) return disableFutureDates
  return combineDisabledDates(
    disableFutureDates,
    disableOutsideDateRange(bounds.periodStartIso, bounds.periodEndExclusiveIso),
  )
})

const drawerTitle = computed(() => {
  if (props.txn) return 'Hareketi düzenle'
  if (props.statementPeriod) return `Yeni hareket — ${props.statementPeriod.label}`
  return 'Yeni kart hareketi'
})

watch(
  () => [props.open, props.txn?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.txn) {
      draft.date = dayjs(props.txn.date)
      draft.type = props.txn.type
      draft.amount = props.txn.amount
      draft.installmentCount = props.txn.installmentCount ?? 1
      draft.repaymentTotal = props.txn.repaymentTotal
      draft.sourceAccountId = props.txn.sourceAccountId
      draft.sourceCashRegisterId = props.txn.sourceCashRegisterId
      draft.targetAccountId = props.txn.targetAccountId
      draft.targetCashRegisterId = props.txn.targetCashRegisterId
      draft.description = props.txn.description ?? ''
      draft.notes = props.txn.notes ?? ''
    } else {
      const bounds =
        props.statementPeriod && !props.txn
          ? cardPeriodBounds(props.statementPeriod)
          : null
      draft.date = bounds ? dayjs(defaultCardTxnDateInPeriod(bounds)) : dayjs()
      draft.type = 'purchase'
      draft.amount = 0
      draft.installmentCount = 1
      draft.repaymentTotal = undefined
      draft.sourceAccountId = undefined
      draft.sourceCashRegisterId = undefined
      draft.targetAccountId = undefined
      draft.targetCashRegisterId = undefined
      draft.description = ''
      draft.notes = ''
    }
  },
)

const supportsInstallments = computed(
  () => draft.type === 'purchase' || draft.type === 'cashAdvance',
)

watch(
  () => draft.type,
  (t) => {
    if (t === 'payment') {
      draft.installmentCount = 1
      draft.repaymentTotal = undefined
    }
  },
)

/** Düzenlemede tahakkuk etmiş taksit sayısı; yeni kayıtta 0. */
const accrued = computed(() => {
  if (!props.txn) return 0
  if (!props.txn.installmentCount || props.txn.installmentCount <= 1) return 0
  return accruedInstallmentCount(props.txn.date, props.txn.installmentCount)
})

const editingLockedTaksit = computed(
  () => Boolean(props.txn) && accrued.value >= 1 && (props.txn?.installmentCount ?? 1) > 1,
)

/**
 * Düzenlemede yalnızca **kalan** taksitleri/tutarı serbest bırak;
 * tahakkuk etmiş kısma ait alanlar kilitli.
 *  - Tarih: hep kilitli (ilk taksit dönemini sabit tutar)
 *  - Taksit sayısı min: tahakkuk eden sayı kadar
 *  - Tutar: per-installment koruma yok; fakat min = sum(tahakkuk eden) gerekir
 */
const minInstallmentCount = computed(() => Math.max(1, accrued.value))
const dateLocked = computed(() => editingLockedTaksit.value)

const accruedTotalAmount = computed(() => {
  if (!editingLockedTaksit.value || !props.txn || !props.card) return 0
  const total = resolveCreditCardRepaymentTotal(props.txn, props.card)
  const parts = splitInstallmentAmount(total, props.txn.installmentCount ?? 1)
  let sum = 0
  for (let i = 0; i < accrued.value && i < parts.length; i++) {
    sum += Number(parts[i])
  }
  return sum
})

const isInstallmentTxn = computed(
  () => supportsInstallments.value && draft.installmentCount > 1,
)

const showRepaymentTotal = computed(() => supportsInstallments.value)

const effectiveRepaymentTotal = computed(() => {
  if (draft.repaymentTotal != null && draft.repaymentTotal > 0) {
    return draft.repaymentTotal
  }
  return draft.amount
})

const amountFieldHint = computed(() => {
  if (draft.type === 'cashAdvance') {
    return 'Hesaba geçen nakit tutarı.'
  }
  if (draft.type === 'purchase') return 'Alışveriş tutarı.'
  return undefined
})

const repaymentTotalHint =
  'Kart borcuna yansıyan toplam. Boş bırakılırsa tutarın aynısı kullanılır; faiz/ek ücret eklenmek istenirse buraya yazın.'

const perInstallment = computed(() => {
  if (!isInstallmentTxn.value) return null
  const parts = splitInstallmentAmount(effectiveRepaymentTotal.value, draft.installmentCount)
  return {
    first: Number(parts[0] ?? 0),
    last: Number(parts[parts.length - 1] ?? 0),
    count: draft.installmentCount,
  }
})

async function submit(): Promise<void> {
  if (!props.card) return
  if (draft.amount <= 0) {
    message.error('Tutar sıfırdan büyük olmalı.')
    return
  }
  const bounds = createPeriodBounds.value
  if (bounds && !isCardTxnDateInPeriod(draft.date.toISOString(), bounds)) {
    message.error('Hareket tarihi seçili dönem dışında.')
    return
  }
  if (supportsInstallments.value && draft.installmentCount > 1) {
    if (draft.installmentCount < minInstallmentCount.value) {
      message.error(
        `Taksit sayısı en az ${minInstallmentCount.value} olmalı (zaten tahakkuk etmiş).`,
      )
      return
    }
    if (
      editingLockedTaksit.value &&
      effectiveRepaymentTotal.value < accruedTotalAmount.value
    ) {
      message.error(
        'Geri ödenecek tutar tahakkuk etmiş taksitlerin altına düşemez.',
      )
      return
    }
  }
  if (
    draft.type !== 'payment' &&
    draft.repaymentTotal != null &&
    draft.repaymentTotal > 0 &&
    draft.repaymentTotal < draft.amount
  ) {
    message.error('Geri ödenecek tutar işlem tutarının altında olamaz.')
    return
  }
  saving.value = true
  try {
    const installmentCount =
      supportsInstallments.value && draft.installmentCount > 1
        ? Math.floor(draft.installmentCount)
        : undefined
    const repaymentTotal =
      draft.type !== 'payment' &&
      draft.repaymentTotal != null &&
      draft.repaymentTotal > 0
        ? Number(draft.repaymentTotal)
        : undefined
    await entities.save<CreditCardTransaction>('creditCardTransaction', {
      id: props.txn?.id,
      cardId: props.card.id,
      date: draft.date.toISOString(),
      type: draft.type,
      amount: Number(draft.amount),
      installmentCount,
      repaymentTotal,
      sourceAccountId: draft.type === 'payment' ? draft.sourceAccountId : undefined,
      sourceCashRegisterId:
        draft.type === 'payment' ? draft.sourceCashRegisterId : undefined,
      targetAccountId: draft.type === 'cashAdvance' ? draft.targetAccountId : undefined,
      targetCashRegisterId:
        draft.type === 'cashAdvance' ? draft.targetCashRegisterId : undefined,
      description: draft.description.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    })
    message.success(props.txn ? 'Hareket güncellendi.' : 'Hareket eklendi.')
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.txn) return
  saving.value = true
  try {
    await entities.remove('creditCardTransaction', props.txn.id)
    message.success('Hareket silindi.')
    emit('saved')
    emit('update:open', false)
  } catch {
    message.error('Silinemedi.')
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
    stack-id="credit-card-txn"
    :open="open"
    :title="drawerTitle"
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <DismissibleDrawerAlert
      v-if="editingLockedTaksit"
      hint-key="credit-card-txn.installment-lock"
      type="warning"
      message="Taksitli işlem düzenleniyor"
      :description="`${accrued} taksit zaten tahakkuk etmiş; tarih sabit, taksit sayısı en az ${minInstallmentCount} olmalı. Geri ödenecek tutar tahakkuk etmiş kısmın altına düşemez.`"
    />

    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem required>
        <template #label>
          <KpFormLabel :hint="createPeriodDateHint">Tarih</KpFormLabel>
        </template>
        <LocaleDatePicker
          v-model:value="draft.date"
          :disabled-date="disabledTxnDate"
          :disabled="dateLocked"
          style="width: 100%"
        />
      </FormItem>
      <FormItem label="Tür" required>
        <KpSelect v-model:value="draft.type" :options="typeOptions" />
      </FormItem>

      <FormItem required>
        <template #label>
          <KpFormLabel :hint="amountFieldHint">Tutar</KpFormLabel>
        </template>
        <LocaleInputNumber v-model:value="draft.amount" kind="currency" :min="0" />
      </FormItem>

      <FormItem v-if="supportsInstallments">
        <template #label>
          <KpFormLabel hint="1 = peşin; 2 ve üzeri taksitli işlem.">
            Taksit sayısı
          </KpFormLabel>
        </template>
        <LocaleInputNumber
          v-model:value="draft.installmentCount"
          kind="integer"
          :min="minInstallmentCount"
          :max="36"
        />
      </FormItem>

      <FormItem v-if="showRepaymentTotal">
        <template #label>
          <KpFormLabel :hint="repaymentTotalHint">Geri ödenecek tutar</KpFormLabel>
        </template>
        <LocaleInputNumber
          v-model:value="draft.repaymentTotal"
          kind="currency"
          :min="editingLockedTaksit ? accruedTotalAmount : draft.amount || 0"
          :placeholder="
            draft.amount > 0 && card
              ? formatCurrency(draft.amount, card.currency)
              : undefined
          "
        />
        <div v-if="perInstallment && card" class="kp-txn-installment-hint">
          {{ perInstallment.count }} taksit × {{ formatCurrency(perInstallment.first, card.currency) }}
          <span v-if="perInstallment.first !== perInstallment.last">
            (son taksit {{ formatCurrency(perInstallment.last, card.currency) }})
          </span>
        </div>
      </FormItem>

      <PaymentSourcePicker
        v-if="draft.type === 'payment'"
        v-model:accountId="draft.sourceAccountId"
        v-model:cashRegisterId="draft.sourceCashRegisterId"
        label="Ödendiği hesap / kasa"
        :label-tooltip="paymentSourceTooltip"
      />
      <PaymentSourcePicker
        v-if="draft.type === 'cashAdvance'"
        v-model:accountId="draft.targetAccountId"
        v-model:cashRegisterId="draft.targetCashRegisterId"
        kind="target"
        label="Çekilen nakit hesabı / kasası"
        :label-tooltip="cashAdvanceTargetTooltip"
      />

      <FormItem label="Açıklama">
        <Input v-model:value="draft.description" />
      </FormItem>
      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="2" />
      </FormItem>

      <div v-if="txn" class="kp-form-drawer-danger-row">
        <Popconfirm
          placement="topRight"
          overlay-class-name="kp-popoverlay-edge"
          :title="
            txn.installmentCount && txn.installmentCount > 1
              ? `Bu taksitli işlem (${txn.installmentCount} taksit) silinsin mi?`
              : 'Bu hareket silinsin mi?'
          "
          ok-text="Sil"
          cancel-text="Vazgeç"
          :ok-button-props="{ danger: true }"
          @confirm="remove"
        >
          <Button danger ghost size="small" :loading="saving">Sil</Button>
        </Popconfirm>
      </div>
    </Form>

    <template #actions>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>
</template>

<style scoped>
.kp-txn-installment-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ant-color-text-secondary);
}
</style>
