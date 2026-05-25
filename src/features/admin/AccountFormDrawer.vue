<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  Select,
  Space,
  Button,
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
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import LocaleDatePicker from '@/components/LocaleDatePicker.vue'
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import BankFormDrawer from '@/features/admin/BankFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useAccountBalances } from '@/features/cashflow/useAccountBalances'
import { SUPPORTED_CURRENCIES } from '@/core/locale/defaults'
import type { Account, Bank } from '@/core/types/entities'
import { AccountTypes } from '@/core/types/entities'

interface Props {
  open: boolean
  account?: Account | null
  /** Borç ödemesi kaynağından açılırsa para birimi profil yereline kilitlenir. */
  lockCurrency?: boolean
}

const props = withDefaults(defineProps<Props>(), { account: null, lockCurrency: false })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: Account): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()

const banks = entities.list<Bank>('bank')

interface Form {
  bankId: string | undefined
  name: string
  type: Account['type']
  currency: string
  iban: string
  openingBalance: number
  openingDate: Dayjs
  notes: string
  archived: boolean
  sensitive: boolean
}

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

function emptyForm(): Form {
  return {
    bankId: undefined,
    name: '',
    type: 'checking',
    currency: profileCurrency(),
    iban: '',
    openingBalance: 0,
    openingDate: dayjs(),
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const bankDrawerOpen = ref(false)

const typeOptions = computed(() =>
  AccountTypes.map((value) => ({
    value,
    label: ACCOUNT_TYPE_LABELS[value],
  })),
)

const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  checking: 'Vadesiz',
  savings: 'Vadeli',
  fx: 'Döviz',
  other: 'Diğer',
}

/**
 * Düzenleme modunda mevcut currency listemizde yoksa onu da bir defaya mahsus
 * ekleriz — kullanıcı eski / özel bir kod ile kayıt yapmışsa Select'te
 * görünmesi şart (aksi takdirde değer "kayıp" görünür).
 */
const currencyOptions = computed(() => {
  const base = SUPPORTED_CURRENCIES.map((c) => ({ value: c.value as string, label: c.label }))
  const current = draft.currency
  if (current && !base.some((o) => o.value === current)) {
    base.push({ value: current, label: `${current} (özel)` })
  }
  return base
})

const isProfileCurrency = computed(() => draft.currency === profileCurrency())

const { movements } = useAccountBalances()
/**
 * **Kural** (cross-currency invariant): Hesap bir kez gerçekleşmiş hareket
 * görmüşse para birimi değiştirilemez; geçmiş hareketler hep o currency'de
 * kaydedildi, sonradan değişirse bakiye anlamsızlaşır. UI'da Select disabled
 * + extra açıklama.
 */
const hasMovements = computed<boolean>(() => {
  if (!props.account) return false
  const id = props.account.id
  return movements.value.some((m) => m.accountId === id)
})

watch(
  () => [props.open, props.account?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.account) {
      Object.assign(draft, {
        bankId: props.account.bankId,
        name: props.account.name,
        type: props.account.type,
        currency: props.account.currency,
        iban: props.account.iban ?? '',
        openingBalance: props.account.openingBalance,
        openingDate: dayjs(props.account.openingDate),
        notes: props.account.notes ?? '',
        archived: !!props.account.archived,
        sensitive: readSensitiveDraft('account', props.account.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

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
    message.error('Hesap adı gerekli.')
    return
  }
  saving.value = true
  try {
    const code = (props.lockCurrency ? profileCurrency() : draft.currency || profileCurrency()).toUpperCase()
    if (code.length !== 3) {
      message.error('Para birimi 3 harfli kod olmalı (örn. TRY, USD).')
      return
    }
    if (hasMovements.value && props.account && code !== props.account.currency) {
      message.error('Bu hesaba ait hareketler olduğu için para birimi değiştirilemez.')
      return
    }
    const saved = await entities.save<Account>('account', {
      id: props.account?.id,
      bankId: draft.bankId,
      name: draft.name.trim(),
      type: draft.type,
      currency: code,
      iban: draft.iban.trim() || undefined,
      openingBalance: Number(draft.openingBalance) || 0,
      openingDate: draft.openingDate.toISOString(),
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
    stack-id="account-form"
    :open="open"
    :title="account ? 'Hesabı düzenle' : 'Yeni hesap'"
    width="min(580px, 100vw)"
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
        <Input v-model:value="draft.name" placeholder="Örn. Maaş hesabı" />
      </FormItem>
      <FormItem label="Tür" required>
        <Select v-model:value="draft.type" :options="typeOptions" />
      </FormItem>
      <FormItem
        v-if="!lockCurrency"
        label="Para birimi"
        required
        :extra="
          hasMovements
            ? 'Bu hesaba ait gerçekleşmiş hareketler olduğu için para birimi değiştirilemez.'
            : isProfileCurrency
              ? undefined
              : 'Dövizli hesap: borç ödemeleri için kullanılamaz; yalnız gelir / gider / transfer kaydedilebilir.'
        "
      >
        <Select
          v-model:value="draft.currency"
          :options="currencyOptions"
          :disabled="hasMovements"
          show-search
          option-filter-prop="label"
        />
      </FormItem>
      <FormItem
        v-else
        label="Para birimi"
        :extra="`Borç ödemesi kaynağı: ${profileCurrency()} (profil para birimi).`"
      >
        <Input :value="profileCurrency()" disabled />
      </FormItem>
      <FormItem label="IBAN">
        <Input v-model:value="draft.iban" placeholder="TR.." />
      </FormItem>
      <FormItem label="Açılış bakiyesi">
        <LocaleInputNumber v-model:value="draft.openingBalance" kind="currency" />
      </FormItem>
      <FormItem label="Açılış tarihi" required>
        <LocaleDatePicker v-model:value="draft.openingDate" style="width: 100%" />
      </FormItem>
      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="3" />
      </FormItem>
      <SensitiveRecordSwitch v-model:sensitive="draft.sensitive" v-model:archived="draft.archived" />
    </Form>

    <template #extra>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>

  <BankFormDrawer v-model:open="bankDrawerOpen" @saved="onBankSaved" />
</template>
