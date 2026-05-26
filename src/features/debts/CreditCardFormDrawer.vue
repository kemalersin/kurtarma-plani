<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  Space,
  Button,
  message,
} from 'ant-design-vue'
import FormDrawer from '@/components/FormDrawer.vue'
import SensitiveRecordSwitch from '@/components/SensitiveRecordSwitch.vue'
import {
  emptySensitiveFields,
  readSensitiveDraft,
  sensitiveSaveOptions,
} from '@/composables/useSensitiveEntityForm'
import KpFormLabel from '@/components/KpFormLabel.vue'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import BankFormDrawer from '@/features/admin/BankFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useBankingPresetStore } from '@/stores/banking-preset'
import type { Bank, CreditCard } from '@/core/types/entities'

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

const banks = entities.list<Bank>('bank')

interface Form {
  name: string
  bankId: string | undefined
  limit: number
  openingBalance: number
  statementCutoffDay: number
  paymentDueDay: number
  purchaseAprMonthly: number
  lateAprMonthly: number | undefined
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  return {
    name: '',
    bankId: undefined,
    limit: 30_000,
    openingBalance: 0,
    statementCutoffDay: 15,
    paymentDueDay: 25,
    purchaseAprMonthly: 3.75,
    lateAprMonthly: undefined,
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
  () => [props.open, props.card?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.card) {
      Object.assign(draft, {
        name: props.card.name,
        bankId: props.card.bankId,
        limit: props.card.limit,
        openingBalance: props.card.openingBalance ?? 0,
        statementCutoffDay: props.card.statementCutoffDay,
        paymentDueDay: props.card.paymentDueDay,
        purchaseAprMonthly: props.card.purchaseAprMonthly * 100,
        lateAprMonthly:
          props.card.lateAprMonthly != null ? props.card.lateAprMonthly * 100 : undefined,
        notes: props.card.notes ?? '',
        archived: !!props.card.archived,
        sensitive: readSensitiveDraft('creditCard', props.card.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

function pickTier<T extends { maxBalance: number | null }>(
  tiers: readonly T[],
  limit: number,
): T | undefined {
  for (const t of tiers) {
    if (t.maxBalance == null || limit <= t.maxBalance) return t
  }
  return tiers[tiers.length - 1]
}

function fillRefPurchase(): void {
  const tier = pickTier(
    presetStore.active.preset.creditCard.maxRatesByBalanceTier,
    draft.limit,
  )
  if (tier?.purchaseAprMonthly != null) {
    draft.purchaseAprMonthly = tier.purchaseAprMonthly * 100
    message.success(
      `Alışveriş aylık faizi referanstan dolduruldu (limit tier'ı: ${(tier.purchaseAprMonthly * 100).toFixed(2)}%).`,
    )
  } else {
    message.info('Referansta alışveriş faizi tanımlı değil.')
  }
}

function fillRefLate(): void {
  const tier = pickTier(
    presetStore.active.preset.creditCard.maxRatesByBalanceTier,
    draft.limit,
  )
  if (tier?.lateAprMonthly != null) {
    draft.lateAprMonthly = tier.lateAprMonthly * 100
    message.success(
      `Gecikme aylık faizi referanstan dolduruldu (${(tier.lateAprMonthly * 100).toFixed(2)}%).`,
    )
  } else {
    message.info('Referansta gecikme faizi tanımlı değil.')
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
    message.error('Kart adı gerekli.')
    return
  }
  if (draft.limit <= 0) {
    message.error('Limit sıfırdan büyük olmalı.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<CreditCard>('creditCard', {
      id: props.card?.id,
      name: draft.name.trim(),
      bankId: draft.bankId,
      currency: props.card?.currency ?? profileCurrency(),
      limit: Number(draft.limit),
      openingBalance: Number(draft.openingBalance) || 0,
      statementCutoffDay: Number(draft.statementCutoffDay),
      paymentDueDay: Number(draft.paymentDueDay),
      purchaseAprMonthly: Number(draft.purchaseAprMonthly) / 100,
      lateAprMonthly:
        draft.lateAprMonthly !== undefined
          ? Number(draft.lateAprMonthly) / 100
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
          <KpFormLabel hint="Boş bırakılırsa alışveriş × 1.087 (≈ +0.30 puan) varsayılır.">
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
