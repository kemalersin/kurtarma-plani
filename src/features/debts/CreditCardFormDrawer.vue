<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  Space,
  Button,
  message,
  Select,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
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
import { creditCardTaxRateFromPreset } from '@/core/util/banking-preset-credit-card'
import { pickCreditCardBalanceTier } from '@/finance/credit-card'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useBankingPresetStore } from '@/stores/banking-preset'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { Bank, CreditCard, CreditCardRateMode } from '@/core/types/entities'

interface Props {
  open: boolean
  card?: CreditCard | null
}
const props = withDefaults(defineProps<Props>(), { card: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: CreditCard): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const presetStore = useBankingPresetStore()
const { formatCurrency, formatPercentFromFraction } = useLocaleFormatters()

const banks = entities.list<Bank>('bank')

const rateModeOptions = [
  { value: 'fixed', label: 'Sabit sözleşme oranı' },
  { value: 'balanceTier', label: 'Dönem borcuna göre kademeli (referans)' },
]

interface Form {
  name: string
  bankId: string | undefined
  limit: number
  openingBalance: number
  openingDate: Dayjs
  statementCutoffDay: number
  paymentDueDay: number
  rateMode: CreditCardRateMode
  purchaseAprMonthly: number
  lateAprMonthly: number | undefined
  cashAdvanceAprMonthly: number | undefined
  taxRateMonthly: number | undefined
  notes: string
  archived: boolean
  sensitive: boolean
}

function presetTierDebtHint(): number {
  const debt = draft.openingBalance > 0 ? draft.openingBalance : draft.limit
  return debt
}

function emptyForm(): Form {
  const preset = presetStore.active.preset
  const tier = pickCreditCardBalanceTier(
    preset.creditCard.maxRatesByBalanceTier,
    30_000,
  )
  const tax = creditCardTaxRateFromPreset(preset)
  return {
    name: '',
    bankId: undefined,
    limit: 30_000,
    openingBalance: 0,
    openingDate: dayjs(),
    statementCutoffDay: 15,
    paymentDueDay: 25,
    rateMode: 'balanceTier',
    purchaseAprMonthly: tier.purchaseAprMonthly * 100,
    lateAprMonthly: tier.lateAprMonthly * 100,
    cashAdvanceAprMonthly: preset.creditCard.cashAdvanceAprMonthly * 100,
    taxRateMonthly: tax > 0 ? tax * 100 : undefined,
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const bankDrawerOpen = ref(false)
const isFixedRateMode = computed(() => draft.rateMode === 'fixed')

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

watch(
  () => [props.open, props.card?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.card) {
      Object.assign(draft, {
        name: props.card.name,
        bankId: props.card.bankId,
        limit: props.card.limit,
        openingBalance: props.card.openingBalance ?? 0,
        openingDate: dayjs(props.card.openingDate ?? props.card.createdAt),
        statementCutoffDay: props.card.statementCutoffDay,
        paymentDueDay: props.card.paymentDueDay,
        rateMode: props.card.rateMode ?? 'fixed',
        purchaseAprMonthly: props.card.purchaseAprMonthly * 100,
        lateAprMonthly:
          props.card.lateAprMonthly != null ? props.card.lateAprMonthly * 100 : undefined,
        cashAdvanceAprMonthly:
          props.card.cashAdvanceAprMonthly != null
            ? props.card.cashAdvanceAprMonthly * 100
            : undefined,
        taxRateMonthly:
          props.card.taxRateMonthly != null ? props.card.taxRateMonthly * 100 : undefined,
        notes: props.card.notes ?? '',
        archived: !!props.card.archived,
        sensitive: readSensitiveDraft('creditCard', props.card.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

function fillRefPurchase(): void {
  const tiers = presetStore.active.preset.creditCard.maxRatesByBalanceTier
  const tier = pickCreditCardBalanceTier(tiers, presetTierDebtHint())
  draft.purchaseAprMonthly = tier.purchaseAprMonthly * 100
  message.success(
    `Alışveriş faizi referanstan dolduruldu (${formatPercentFromFraction(tier.purchaseAprMonthly)} — ${formatCurrency(presetTierDebtHint())} dilimi).`,
  )
}

function fillRefLate(): void {
  const tiers = presetStore.active.preset.creditCard.maxRatesByBalanceTier
  const tier = pickCreditCardBalanceTier(tiers, presetTierDebtHint())
  draft.lateAprMonthly = tier.lateAprMonthly * 100
  message.success(
    `Gecikme faizi referanstan dolduruldu (${formatPercentFromFraction(tier.lateAprMonthly)}).`,
  )
}

function fillRefCashAdvance(): void {
  const cc = presetStore.active.preset.creditCard
  draft.cashAdvanceAprMonthly = cc.cashAdvanceAprMonthly * 100
  message.success(
    `Nakit avans faizi referanstan dolduruldu (${formatPercentFromFraction(cc.cashAdvanceAprMonthly)}).`,
  )
}

function fillRefTax(): void {
  const tax = creditCardTaxRateFromPreset(presetStore.active.preset)
  if (tax <= 0) {
    message.info('Referansta KKDF/BSMV tanımlı değil.')
    return
  }
  draft.taxRateMonthly = tax * 100
  message.success(
    `Faiz vergisi (KKDF+BSMV) referanstan dolduruldu (${formatPercentFromFraction(tax)}).`,
  )
}

function openBankDrawer(): void {
  bankDrawerOpen.value = true
}
function onBankSaved(b: Bank): void {
  draft.bankId = b.id
}

async function submit(): Promise<void> {
  if (!draft.bankId) {
    message.error('Banka seçimi gerekli.')
    return
  }
  if (!draft.name.trim()) {
    message.error('Kart adı gerekli.')
    return
  }
  if (draft.limit <= 0) {
    message.error('Limit sıfırdan büyük olmalı.')
    return
  }
  if (draft.rateMode === 'fixed' && draft.purchaseAprMonthly == null) {
    message.error('Alışveriş aylık faizi gerekli.')
    return
  }
  saving.value = true
  try {
    const preset = presetStore.active.preset
    const tier = pickCreditCardBalanceTier(
      preset.creditCard.maxRatesByBalanceTier,
      presetTierDebtHint(),
    )
    const purchaseAprMonthly =
      draft.rateMode === 'fixed'
        ? Number(draft.purchaseAprMonthly) / 100
        : tier.purchaseAprMonthly
    const lateAprMonthly =
      draft.rateMode === 'fixed'
        ? draft.lateAprMonthly !== undefined
          ? Number(draft.lateAprMonthly) / 100
          : undefined
        : tier.lateAprMonthly
    const cashAdvanceAprMonthly =
      draft.rateMode === 'fixed'
        ? draft.cashAdvanceAprMonthly !== undefined
          ? Number(draft.cashAdvanceAprMonthly) / 100
          : undefined
        : preset.creditCard.cashAdvanceAprMonthly

    const saved = await entities.save<CreditCard>('creditCard', {
      id: props.card?.id,
      name: draft.name.trim(),
      bankId: draft.bankId,
      currency: props.card?.currency ?? profileCurrency(),
      limit: Number(draft.limit),
      openingBalance: Number(draft.openingBalance) || 0,
      openingDate: draft.openingDate.toISOString(),
      statementCutoffDay: Number(draft.statementCutoffDay),
      paymentDueDay: Number(draft.paymentDueDay),
      rateMode: draft.rateMode,
      purchaseAprMonthly,
      lateAprMonthly,
      cashAdvanceAprMonthly,
      taxRateMonthly:
        draft.taxRateMonthly !== undefined
          ? Number(draft.taxRateMonthly) / 100
          : undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.card ? 'Kart güncellendi.' : 'Kart eklendi.')
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
    stack-id="credit-card-form"
    :open="open"
    :title="card ? 'Kartı düzenle' : 'Yeni kredi kartı'"
    width="min(560px, 100vw)"
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
      <FormItem label="Kart adı" required>
        <Input v-model:value="draft.name" placeholder="Örn. World Mastercard" />
      </FormItem>
      <FormItem label="Limit" required>
        <LocaleInputNumber v-model:value="draft.limit" kind="currency" :min="0" />
      </FormItem>
      <FormItem label="Açılış bakiyesi (devreden)">
        <LocaleInputNumber v-model:value="draft.openingBalance" kind="currency" :min="0" />
      </FormItem>
      <FormItem label="Açılış tarihi" required>
        <LocaleDatePicker v-model:value="draft.openingDate" style="width: 100%" />
      </FormItem>
      <div style="display: flex; gap: 12px; width: 100%; align-items: flex-start">
        <FormItem label="Hesap kesim günü" required style="flex: 1; min-width: 0">
          <LocaleInputNumber
            v-model:value="draft.statementCutoffDay"
            kind="integer"
            :min="1"
            :max="28"
          />
        </FormItem>
        <FormItem label="Son ödeme günü" required style="flex: 1; min-width: 0">
          <LocaleInputNumber
            v-model:value="draft.paymentDueDay"
            kind="integer"
            :min="1"
            :max="28"
          />
        </FormItem>
      </div>
      <FormItem>
        <template #label>
          <KpFormLabel
            hint="Kademeli modda faizler dönem borcuna göre bankacılık referansından uygulanır. Sabit modda elle girilen sözleşme oranları kullanılır."
          >
            Faiz modu
          </KpFormLabel>
        </template>
        <Select v-model:value="draft.rateMode" :options="rateModeOptions" />
      </FormItem>
      <DismissibleDrawerAlert
        v-if="!isFixedRateMode"
        hint-key="credit-card-form.balance-tier-rates"
        message="Referans faiz kademesi"
        description="Akdi ve gecikme faizleri her dönemde borç tutarına göre Ayarlar'daki bankacılık referansından seçilir. Sözleşme oranınızı biliyorsanız faiz modu olarak sabit sözleşme oranı seçin."
      />
      <template v-if="isFixedRateMode">
        <FormItem label="Alışveriş aylık faizi (%)" required>
          <Space.Compact style="width: 100%">
            <LocaleInputNumber
              v-model:value="draft.purchaseAprMonthly"
              kind="percent"
              :min="0"
              style="flex: 1; min-width: 0"
            />
            <Button @click="fillRefPurchase">Referansla doldur</Button>
          </Space.Compact>
        </FormItem>
        <FormItem>
          <template #label>
            <KpFormLabel hint="Boş bırakılırsa alışveriş × 1.087 (≈ +0,30 puan) varsayılır.">
              Gecikme aylık faizi (%)
            </KpFormLabel>
          </template>
          <Space.Compact style="width: 100%">
            <LocaleInputNumber
              v-model:value="draft.lateAprMonthly"
              kind="percent"
              :min="0"
              placeholder="Boş bırakılabilir"
              style="flex: 1; min-width: 0"
            />
            <Button @click="fillRefLate">Referansla doldur</Button>
          </Space.Compact>
        </FormItem>
        <FormItem>
          <template #label>
            <KpFormLabel hint="Boş bırakılırsa alışveriş faizi kullanılır.">
              Nakit avans aylık faizi (%)
            </KpFormLabel>
          </template>
          <Space.Compact style="width: 100%">
            <LocaleInputNumber
              v-model:value="draft.cashAdvanceAprMonthly"
              kind="percent"
              :min="0"
              placeholder="Boş bırakılabilir"
              style="flex: 1; min-width: 0"
            />
            <Button @click="fillRefCashAdvance">Referansla doldur</Button>
          </Space.Compact>
        </FormItem>
      </template>
      <FormItem>
        <template #label>
          <KpFormLabel hint="KKDF + BSMV toplamı; faiz hesabına eklenir (örn. %25).">
            Faiz vergisi (%)
          </KpFormLabel>
        </template>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.taxRateMonthly"
            kind="percent"
            :min="0"
            placeholder="Boş bırakılabilir"
            style="flex: 1; min-width: 0"
          />
          <Button @click="fillRefTax">Referansla doldur</Button>
        </Space.Compact>
      </FormItem>
      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="2" />
      </FormItem>
      <SensitiveRecordSwitch v-model:sensitive="draft.sensitive" v-model:archived="draft.archived" />
    </Form>

    <template #actions>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>

  <BankFormDrawer v-model:open="bankDrawerOpen" @saved="onBankSaved" />
</template>
