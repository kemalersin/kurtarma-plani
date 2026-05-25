<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  Switch,
  Select,
  Space,
  Button,
  message,
} from 'ant-design-vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import SensitiveRecordSwitch from '@/components/SensitiveRecordSwitch.vue'
import {
  emptySensitiveFields,
  readSensitiveDraft,
  sensitiveSaveOptions,
} from '@/composables/useSensitiveEntityForm'
import KpFormLabel from '@/components/KpFormLabel.vue'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import LocaleDatePicker from '@/components/LocaleDatePicker.vue'
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import BankFormDrawer from '@/features/admin/BankFormDrawer.vue'
import CashAdvanceFormDrawer from '@/features/debts/CashAdvanceFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useBankingPresetStore } from '@/stores/banking-preset'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  Bank,
  CashAdvanceAccount,
  InstallmentCashAdvance,
  RatePeriodEnum,
} from '@/core/types/entities'
import { buildAnnuitySchedule } from '@/finance/loan'
import { D } from '@/finance/decimal'

interface Props {
  open: boolean
  advance?: InstallmentCashAdvance | null
}
const props = withDefaults(defineProps<Props>(), { advance: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: InstallmentCashAdvance): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const presetStore = useBankingPresetStore()
const { formatCurrency, formatNumber } = useLocaleFormatters()

const banks = entities.list<Bank>('bank')
const cashAdvances = entities.list<CashAdvanceAccount>('cashAdvanceAccount')

const PERIOD_OPTIONS: { value: RatePeriodEnum; label: string }[] = [
  { value: 'monthly', label: 'Aylık' },
  { value: 'annual', label: 'Yıllık' },
]

interface Form {
  name: string
  bankId: string | undefined
  cashAdvanceAccountId: string | undefined
  principal: number
  termMonths: number
  startDate: Dayjs
  firstInstallmentDate: Dayjs
  interestRate: number
  interestPeriod: RatePeriodEnum
  lateInterestRate: number | undefined
  lateInterestPeriod: RatePeriodEnum
  taxRateMonthly: number | undefined
  earlyPayoffWithoutInterest: boolean
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  const today = dayjs()
  return {
    name: '',
    bankId: undefined,
    cashAdvanceAccountId: undefined,
    principal: 25_000,
    termMonths: 12,
    startDate: today,
    firstInstallmentDate: today.add(1, 'month'),
    interestRate: 4.25,
    interestPeriod: 'monthly',
    lateInterestRate: undefined,
    lateInterestPeriod: 'monthly',
    taxRateMonthly: undefined,
    earlyPayoffWithoutInterest: false,
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const bankDrawerOpen = ref(false)
const caDrawerOpen = ref(false)

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

const preview = computed(() => {
  if (!draft.principal || !draft.termMonths || draft.interestRate < 0) return null
  try {
    return buildAnnuitySchedule({
      principal: draft.principal,
      termMonths: draft.termMonths,
      interestRate: {
        value: draft.interestRate / 100,
        period: draft.interestPeriod,
      },
      firstInstallmentDate: draft.firstInstallmentDate.toISOString(),
      taxRateMonthly:
        draft.taxRateMonthly !== undefined ? draft.taxRateMonthly / 100 : undefined,
    })
  } catch {
    return null
  }
})

function formatMoney(value: string | number): string {
  return formatCurrency(value)
}

const previewStats = computed<KpStat[]>(() => {
  const p = preview.value
  if (!p) return []
  return [
    {
      label: 'Aylık taksit',
      value: formatMoney(p.installment),
      tone: 'primary',
    },
    { label: 'Toplam ödeme', value: formatMoney(p.totalPayment) },
    { label: 'Toplam faiz', value: formatMoney(p.totalInterest), tone: 'warning' },
    {
      label: 'Etkin aylık oran',
      value: `${formatNumber(D(p.effectiveMonthlyRate).times(100).toNumber(), { maximumFractionDigits: 2 })} %`,
    },
  ]
})

watch(
  () => [props.open, props.advance?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.advance) {
      Object.assign(draft, {
        name: props.advance.name,
        bankId: props.advance.bankId,
        cashAdvanceAccountId: props.advance.cashAdvanceAccountId,
        principal: props.advance.principal,
        termMonths: props.advance.termMonths,
        startDate: dayjs(props.advance.startDate),
        firstInstallmentDate: dayjs(props.advance.firstInstallmentDate),
        interestRate: props.advance.interestRate * 100,
        interestPeriod: props.advance.interestPeriod,
        lateInterestRate:
          props.advance.lateInterestRate != null
            ? props.advance.lateInterestRate * 100
            : undefined,
        lateInterestPeriod: props.advance.lateInterestPeriod ?? 'monthly',
        taxRateMonthly:
          props.advance.taxRateMonthly != null
            ? props.advance.taxRateMonthly * 100
            : undefined,
        earlyPayoffWithoutInterest: !!props.advance.earlyPayoffWithoutInterest,
        notes: props.advance.notes ?? '',
        archived: !!props.advance.archived,
        sensitive: readSensitiveDraft('installmentCashAdvance', props.advance.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

function fillRefRate(): void {
  const ceil =
    presetStore.active.preset.cashAdvance?.monthlyAprCeiling ??
    presetStore.active.preset.creditCard.cashAdvanceAprMonthly
  if (ceil != null) {
    draft.interestRate = ceil * 100
    draft.interestPeriod = 'monthly'
    message.success(
      `Aylık akdi faiz referanstan dolduruldu (${(ceil * 100).toFixed(2)}%).`,
    )
  } else {
    message.info('Referansta nakit avans tavanı tanımlı değil.')
  }
}

function fillRefLate(): void {
  const ceil = presetStore.active.preset.cashAdvance?.lateAprCeiling
  if (ceil != null) {
    draft.lateInterestRate = ceil * 100
    draft.lateInterestPeriod = 'monthly'
    message.success(
      `Aylık gecikme faizi referanstan dolduruldu (${(ceil * 100).toFixed(2)}%).`,
    )
  } else {
    message.info('Referansta gecikme tavanı tanımlı değil.')
  }
}

function fillRefTax(): void {
  const consumer = presetStore.active.preset.consumerLoan
  if (!consumer) {
    message.info('Referans şemasında tüketici kredisi vergi alanı yok.')
    return
  }
  const tax = (consumer.taxRateKkdf ?? 0) + (consumer.taxRateBsmv ?? 0)
  if (tax > 0) {
    draft.taxRateMonthly = tax * 100
    message.success(
      `KKDF + BSMV (${(tax * 100).toFixed(0)}%) referanstan dolduruldu.`,
    )
  } else {
    message.info('Referans vergi oranı tanımlı değil.')
  }
}

function openBankDrawer(): void {
  bankDrawerOpen.value = true
}
function onBankSaved(b: Bank): void {
  draft.bankId = b.id
}
function openCaDrawer(): void {
  caDrawerOpen.value = true
}
function onCaSaved(a: CashAdvanceAccount): void {
  draft.cashAdvanceAccountId = a.id
}

async function submit(): Promise<void> {
  if (!draft.bankId) {
    message.error('Banka seçimi gerekli.')
    return
  }
  if (!draft.name.trim()) {
    message.error('Avans adı gerekli.')
    return
  }
  if (draft.principal <= 0) {
    message.error('Anapara sıfırdan büyük olmalı.')
    return
  }
  if (draft.termMonths <= 0) {
    message.error('Vade sıfırdan büyük olmalı.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<InstallmentCashAdvance>('installmentCashAdvance', {
      id: props.advance?.id,
      name: draft.name.trim(),
      bankId: draft.bankId,
      cashAdvanceAccountId: draft.cashAdvanceAccountId || undefined,
      currency: props.advance?.currency ?? profileCurrency(),
      principal: Number(draft.principal),
      termMonths: Number(draft.termMonths),
      startDate: draft.startDate.toISOString(),
      firstInstallmentDate: draft.firstInstallmentDate.toISOString(),
      interestRate: Number(draft.interestRate) / 100,
      interestPeriod: draft.interestPeriod,
      lateInterestRate:
        draft.lateInterestRate !== undefined
          ? Number(draft.lateInterestRate) / 100
          : undefined,
      lateInterestPeriod:
        draft.lateInterestRate !== undefined ? draft.lateInterestPeriod : undefined,
      taxRateMonthly:
        draft.taxRateMonthly !== undefined
          ? Number(draft.taxRateMonthly) / 100
          : undefined,
      earlyPayoffWithoutInterest: draft.earlyPayoffWithoutInterest || undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.advance ? 'Avans güncellendi.' : 'Avans eklendi.')
    emit('saved', saved)
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
</script>

<template>
  <FormDrawer
    stack-id="installment-advance-form"
    :open="open"
    :title="advance ? 'Taksitli avansı düzenle' : 'Yeni taksitli nakit avans'"
    width="min(640px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Banka" required>
        <SelectWithCreate
          v-model:value="draft.bankId"
          :options="banks"
          placeholder="Banka seçin"
          create-label="Yeni banka"
          @create="openBankDrawer"
        />
      </FormItem>
      <FormItem label="Bağlı nakit avans hesabı">
        <SelectWithCreate
          v-model:value="draft.cashAdvanceAccountId"
          :options="cashAdvances"
          placeholder="Opsiyonel — bağlı hesap"
          create-label="Yeni nakit avans hesabı"
          @create="openCaDrawer"
        />
      </FormItem>
      <FormItem label="Avans adı" required>
        <Input v-model:value="draft.name" placeholder="Örn. Taksitli nakit avans #1" />
      </FormItem>
      <FormItem label="Anapara" required>
        <LocaleInputNumber v-model:value="draft.principal" kind="currency" :min="0" />
      </FormItem>
      <FormItem label="Vade (ay)" required>
        <LocaleInputNumber
          v-model:value="draft.termMonths"
          kind="integer"
          :min="1"
          :max="360"
        />
      </FormItem>
      <FormItem label="Başlangıç tarihi" required>
        <LocaleDatePicker v-model:value="draft.startDate" style="width: 100%" />
      </FormItem>
      <FormItem label="İlk taksit tarihi" required>
        <LocaleDatePicker v-model:value="draft.firstInstallmentDate" style="width: 100%" />
      </FormItem>
      <FormItem label="Sözleşme faizi (%)" required>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.interestRate"
            kind="percent"
            :min="0"
            style="flex: 1; min-width: 0"
          />
          <Select v-model:value="draft.interestPeriod" :options="PERIOD_OPTIONS" style="width: 110px" />
          <Button @click="fillRefRate">Referansla doldur</Button>
        </Space.Compact>
      </FormItem>
      <FormItem label="Gecikme faizi (%)">
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.lateInterestRate"
            kind="percent"
            :min="0"
            placeholder="Boş bırakılırsa sözleşme × 1.3"
            style="flex: 1; min-width: 0"
          />
          <Select v-model:value="draft.lateInterestPeriod" :options="PERIOD_OPTIONS" style="width: 110px" />
          <Button @click="fillRefLate">Referansla doldur</Button>
        </Space.Compact>
      </FormItem>
      <FormItem>
        <template #label>
          <KpFormLabel hint="KKDF + BSMV gibi sabit oranlı vergiler. Faiz üzerine eklenir.">
            Aylık vergi oranı (%)
          </KpFormLabel>
        </template>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.taxRateMonthly"
            kind="percent"
            :min="0"
            placeholder="Boş bırakılırsa 0"
            style="flex: 1; min-width: 0"
          />
          <Button @click="fillRefTax">Referansla doldur</Button>
        </Space.Compact>
      </FormItem>
      <FormItem>
        <template #label>
          <KpFormLabel hint="Sözleşmeniz erken kapama için faiz kesmiyor mu? İşaretleyin.">
            Erken kapama faizsiz
          </KpFormLabel>
        </template>
        <Switch v-model:checked="draft.earlyPayoffWithoutInterest" />
      </FormItem>
      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="2" />
      </FormItem>
      <SensitiveRecordSwitch v-model:sensitive="draft.sensitive" v-model:archived="draft.archived" />
    </Form>

    <div v-if="preview" class="kp-loan-preview">
      <div class="kp-loan-preview__title">Hesaplama önizlemesi</div>
      <KpStatRow :items="previewStats" />
    </div>

    <template #actions>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>

  <BankFormDrawer v-model:open="bankDrawerOpen" @saved="onBankSaved" />
  <CashAdvanceFormDrawer v-model:open="caDrawerOpen" @saved="onCaSaved" />
</template>

<style scoped>
.kp-loan-preview {
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  padding-top: 16px;
  margin-top: 8px;
}
.kp-loan-preview__title {
  font-weight: 600;
  margin-bottom: 12px;
}
[data-theme='dark'] .kp-loan-preview {
  border-top-color: rgba(255, 255, 255, 0.1);
}
</style>
