<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  DatePicker,
  Select,
  Space,
  Button,
  message,
} from 'ant-design-vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import SensitiveRecordSwitch from '@/components/SensitiveRecordSwitch.vue'
import {
  emptySensitiveFields,
  readSensitiveDraft,
  sensitiveSaveOptions,
} from '@/composables/useSensitiveEntityForm'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import KpTooltip from '@/components/KpTooltip.vue'
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import BankFormDrawer from '@/features/admin/BankFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useBankingPresetStore } from '@/stores/banking-preset'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { Bank, Loan, RatePeriodEnum } from '@/core/types/entities'
import { buildAnnuitySchedule } from '@/finance/loan'
import { D } from '@/finance/decimal'

interface Props {
  open: boolean
  loan?: Loan | null
}

const props = withDefaults(defineProps<Props>(), { loan: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: Loan): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const presetStore = useBankingPresetStore()
const { formatCurrency, formatNumber } = useLocaleFormatters()

const banks = entities.list<Bank>('bank')

const PERIOD_OPTIONS: { value: RatePeriodEnum; label: string }[] = [
  { value: 'monthly', label: 'Aylık' },
  { value: 'annual', label: 'Yıllık' },
]

interface Form {
  name: string
  bankId: string | undefined
  principal: number
  termMonths: number
  startDate: Dayjs
  firstInstallmentDate: Dayjs
  interestRate: number
  interestPeriod: RatePeriodEnum
  lateInterestRate: number | undefined
  lateInterestPeriod: RatePeriodEnum
  taxRateMonthly: number | undefined
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  const today = dayjs()
  return {
    name: '',
    bankId: undefined,
    principal: 100_000,
    termMonths: 24,
    startDate: today,
    firstInstallmentDate: today.add(1, 'month'),
    interestRate: 4,
    interestPeriod: 'monthly',
    lateInterestRate: undefined,
    lateInterestPeriod: 'monthly',
    taxRateMonthly: undefined,
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const bankDrawerOpen = ref(false)

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

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

watch(
  () => [props.open, props.loan?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.loan) {
        Object.assign(draft, {
        name: props.loan.name,
        bankId: props.loan.bankId,
        principal: props.loan.principal,
        termMonths: props.loan.termMonths,
        startDate: dayjs(props.loan.startDate),
        firstInstallmentDate: dayjs(props.loan.firstInstallmentDate),
        interestRate: props.loan.interestRate * 100,
        interestPeriod: props.loan.interestPeriod,
        lateInterestRate:
          props.loan.lateInterestRate != null
            ? props.loan.lateInterestRate * 100
            : undefined,
        lateInterestPeriod: props.loan.lateInterestPeriod ?? 'monthly',
        taxRateMonthly:
          props.loan.taxRateMonthly != null
            ? props.loan.taxRateMonthly * 100
            : undefined,
        notes: props.loan.notes ?? '',
        archived: !!props.loan.archived,
        sensitive: readSensitiveDraft('loan', props.loan.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

function applyReferenceRate(): void {
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

function fillLateFromContract(): void {
  if (!draft.interestRate || draft.interestRate <= 0) {
    message.info('Önce sözleşme faizini girin.')
    return
  }
  const late = draft.interestRate * 1.3
  draft.lateInterestRate = late
  draft.lateInterestPeriod = draft.interestPeriod
  message.success(
    `Gecikme faizi sözleşmeden hesaplandı (× 1.3 → ${late.toFixed(2)}%).`,
  )
}

function openBankDrawer(): void {
  bankDrawerOpen.value = true
}

function onBankSaved(bank: Bank): void {
  draft.bankId = bank.id
}

async function submit(): Promise<void> {
  if (!draft.bankId) {
    message.error('Banka seçimi gerekli.')
    return
  }
  if (!draft.name.trim()) {
    message.error('Kredi adı gerekli.')
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
    const saved = await entities.save<Loan>('loan', {
      id: props.loan?.id,
      name: draft.name.trim(),
      bankId: draft.bankId,
      currency: profileCurrency(),
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
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.loan ? 'Kredi güncellendi.' : 'Kredi eklendi.')
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
    stack-id="loan-form"
    :open="open"
    :title="loan ? 'Krediyi düzenle' : 'Yeni kredi'"
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
      <FormItem label="Kredi adı" required>
        <Input v-model:value="draft.name" placeholder="Örn. İhtiyaç kredisi" />
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
        <DatePicker v-model:value="draft.startDate" style="width: 100%" />
      </FormItem>
      <FormItem label="İlk taksit tarihi" required>
        <DatePicker v-model:value="draft.firstInstallmentDate" style="width: 100%" />
      </FormItem>
      <FormItem required>
        <template #label>
          <span>Sözleşme faizi (%)</span>
        </template>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.interestRate"
            kind="percent"
            :min="0"
            style="flex: 1; min-width: 0"
          />
          <Select v-model:value="draft.interestPeriod" :options="PERIOD_OPTIONS" style="width: 110px" />
        </Space.Compact>
      </FormItem>
      <FormItem>
        <template #label>
          <Space :size="6">
            <span>Gecikme faizi (%)</span>
            <KpTooltip title="Boş bırakılırsa hesaplamada sözleşme × 1.3 (BDDK uygulaması) kullanılır.">
              <InfoCircleOutlined />
            </KpTooltip>
          </Space>
        </template>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.lateInterestRate"
            kind="percent"
            :min="0"
            placeholder="Boş bırakılırsa sözleşme × 1.3"
            style="flex: 1; min-width: 0"
          />
          <Select v-model:value="draft.lateInterestPeriod" :options="PERIOD_OPTIONS" style="width: 110px" />
          <Button @click="fillLateFromContract">Sözleşmeden hesapla</Button>
        </Space.Compact>
      </FormItem>
      <FormItem>
        <template #label>
          <Space :size="6">
            <span>Aylık vergi oranı (%)</span>
            <KpTooltip title="KKDF + BSMV gibi sabit oranlı vergiler. Faiz üzerine eklenir.">
              <InfoCircleOutlined />
            </KpTooltip>
          </Space>
        </template>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.taxRateMonthly"
            kind="percent"
            :min="0"
            placeholder="Boş bırakılırsa 0"
            style="flex: 1; min-width: 0"
          />
          <Button @click="applyReferenceRate">Referansla doldur</Button>
        </Space.Compact>
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

    <template #extra>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>

  <BankFormDrawer v-model:open="bankDrawerOpen" @saved="onBankSaved" />
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
