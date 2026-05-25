<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Select,
  Space,
  Button,
  Textarea,
  message,
} from 'ant-design-vue'
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
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useBankingPresetStore } from '@/stores/banking-preset'
import type { Bank, CashAdvanceAccount, RatePeriodEnum } from '@/core/types/entities'

interface Props {
  open: boolean
  account?: CashAdvanceAccount | null
}
const props = withDefaults(defineProps<Props>(), { account: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: CashAdvanceAccount): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const presetStore = useBankingPresetStore()

const banks = entities.list<Bank>('bank')

const PERIOD_OPTIONS: { value: RatePeriodEnum; label: string }[] = [
  { value: 'monthly', label: 'Aylık' },
  { value: 'annual', label: 'Yıllık' },
]

interface Form {
  name: string
  bankId: string | undefined
  limit: number
  openingBalance: number
  openingDate: Dayjs
  interestRate: number
  interestPeriod: RatePeriodEnum
  lateInterestRate: number | undefined
  lateInterestPeriod: RatePeriodEnum
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  return {
    name: '',
    bankId: undefined,
    limit: 20_000,
    openingBalance: 0,
    openingDate: dayjs(),
    interestRate: 4.25,
    interestPeriod: 'monthly',
    lateInterestRate: undefined,
    lateInterestPeriod: 'monthly',
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const bankDrawerOpen = ref(false)

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

watch(
  () => [props.open, props.account?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.account) {
      Object.assign(draft, {
        name: props.account.name,
        bankId: props.account.bankId,
        limit: props.account.limit,
        openingBalance: props.account.openingBalance ?? 0,
        openingDate: dayjs(props.account.openingDate),
        interestRate: props.account.interestRate * 100,
        interestPeriod: props.account.interestPeriod,
        lateInterestRate:
          props.account.lateInterestRate != null
            ? props.account.lateInterestRate * 100
            : undefined,
        lateInterestPeriod: props.account.lateInterestPeriod ?? 'monthly',
        notes: props.account.notes ?? '',
        archived: !!props.account.archived,
        sensitive: readSensitiveDraft('cashAdvanceAccount', props.account.id),
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
    message.error('Hesap adı gerekli.')
    return
  }
  if (draft.limit <= 0) {
    message.error('Limit sıfırdan büyük olmalı.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<CashAdvanceAccount>('cashAdvanceAccount', {
      id: props.account?.id,
      name: draft.name.trim(),
      bankId: draft.bankId,
      currency: props.account?.currency ?? profileCurrency(),
      limit: Number(draft.limit),
      openingBalance: Number(draft.openingBalance) || 0,
      openingDate: draft.openingDate.toISOString(),
      interestRate: Number(draft.interestRate) / 100,
      interestPeriod: draft.interestPeriod,
      lateInterestRate:
        draft.lateInterestRate !== undefined
          ? Number(draft.lateInterestRate) / 100
          : undefined,
      lateInterestPeriod:
        draft.lateInterestRate !== undefined ? draft.lateInterestPeriod : undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.account ? 'Hesap güncellendi.' : 'Hesap eklendi.')
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
    stack-id="cash-advance-form"
    :open="open"
    :title="account ? 'Hesabı düzenle' : 'Yeni nakit avans hesabı'"
    width="min(600px, 100vw)"
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
      <FormItem label="Hesap adı" required>
        <Input v-model:value="draft.name" placeholder="Örn. Nakit Avans Hesabı" />
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
      <FormItem label="Faiz (%)" required>
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
      <FormItem>
        <template #label>
          <KpFormLabel hint="Boş bırakılırsa sözleşme faizi × 1.087 varsayılır.">
            Gecikme faizi (%)
          </KpFormLabel>
        </template>
        <Space.Compact style="width: 100%">
          <LocaleInputNumber
            v-model:value="draft.lateInterestRate"
            kind="percent"
            :min="0"
            placeholder="Boş bırakılabilir"
            style="flex: 1; min-width: 0"
          />
          <Select v-model:value="draft.lateInterestPeriod" :options="PERIOD_OPTIONS" style="width: 110px" />
          <Button @click="fillRefLate">Referansla doldur</Button>
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
