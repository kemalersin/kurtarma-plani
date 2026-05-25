<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  RadioGroup,
  Space,
  Button,
  Alert,
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
import BankAccountSelect from '@/components/BankAccountSelect.vue'
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import { disableFutureDates } from '@/core/util/datepicker'
import AccountFormDrawer from '@/features/admin/AccountFormDrawer.vue'
import CashRegisterFormDrawer from '@/features/admin/CashRegisterFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import type { Account, CashRegister, Transfer } from '@/core/types/entities'

interface Props {
  open: boolean
  transfer?: Transfer | null
}
const props = withDefaults(defineProps<Props>(), { transfer: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: Transfer): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()

const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')

type Endpoint = 'account' | 'cashRegister'

interface Form {
  fromKind: Endpoint
  fromAccountId: string | undefined
  fromCashRegisterId: string | undefined
  toKind: Endpoint
  toAccountId: string | undefined
  toCashRegisterId: string | undefined
  amount: number
  exchangeRate: number | undefined
  date: Dayjs
  description: string
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  return {
    fromKind: 'account',
    fromAccountId: undefined,
    fromCashRegisterId: undefined,
    toKind: 'cashRegister',
    toAccountId: undefined,
    toCashRegisterId: undefined,
    amount: 0,
    exchangeRate: undefined,
    date: dayjs(),
    description: '',
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const fromAccountDrawerOpen = ref(false)
const fromRegisterDrawerOpen = ref(false)
const toAccountDrawerOpen = ref(false)
const toRegisterDrawerOpen = ref(false)

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

watch(
  () => [props.open, props.transfer?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.transfer) {
      Object.assign(draft, {
        fromKind: props.transfer.fromAccountId ? 'account' : 'cashRegister',
        fromAccountId: props.transfer.fromAccountId,
        fromCashRegisterId: props.transfer.fromCashRegisterId,
        toKind: props.transfer.toAccountId ? 'account' : 'cashRegister',
        toAccountId: props.transfer.toAccountId,
        toCashRegisterId: props.transfer.toCashRegisterId,
        amount: props.transfer.amount,
        exchangeRate: props.transfer.exchangeRate,
        date: dayjs(props.transfer.date),
        description: props.transfer.description ?? '',
        notes: props.transfer.notes ?? '',
        archived: !!props.transfer.archived,
        sensitive: readSensitiveDraft('transfer', props.transfer.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

watch(
  () => draft.fromKind,
  (k) => {
    if (k === 'account') draft.fromCashRegisterId = undefined
    else draft.fromAccountId = undefined
  },
)
watch(
  () => draft.toKind,
  (k) => {
    if (k === 'account') draft.toCashRegisterId = undefined
    else draft.toAccountId = undefined
  },
)

const endpointOptions = computed<{ value: Endpoint; label: string }[]>(() => [
  { value: 'account', label: 'Banka hesabı' },
  { value: 'cashRegister', label: 'Kasa' },
])

/**
 * Seçili kaynak / hedef varlığın para birimi (yoksa undefined). Hesap → kasa
 * ya da iki hesap arası transferde otomatik bulunur; cross-currency tespitinde
 * de bunlar kullanılır.
 */
function endpointCurrency(
  kind: Endpoint,
  accountId: string | undefined,
  registerId: string | undefined,
): string | undefined {
  if (kind === 'account') return accounts.value.find((a) => a.id === accountId)?.currency
  return registers.value.find((r) => r.id === registerId)?.currency
}

const fromCurrency = computed(() =>
  endpointCurrency(draft.fromKind, draft.fromAccountId, draft.fromCashRegisterId),
)
const toCurrency = computed(() =>
  endpointCurrency(draft.toKind, draft.toAccountId, draft.toCashRegisterId),
)

const isCrossCurrency = computed(
  () =>
    !!fromCurrency.value &&
    !!toCurrency.value &&
    fromCurrency.value !== toCurrency.value,
)

/**
 * Kur her zaman `1 [base] = ? [quote]` formunda istenir; **base** profil
 * yerel para birimi olmayan taraftır (yabancı). Eğer her iki taraf da yabancı
 * ise: from = base (sabit referans).
 */
const baseCurrency = computed<string | undefined>(() => {
  if (!isCrossCurrency.value) return undefined
  const local = profileCurrency()
  if (fromCurrency.value === local) return toCurrency.value
  if (toCurrency.value === local) return fromCurrency.value
  return fromCurrency.value
})

const quoteCurrency = computed<string | undefined>(() => {
  if (!isCrossCurrency.value) return undefined
  return baseCurrency.value === fromCurrency.value ? toCurrency.value : fromCurrency.value
})

/**
 * Cross-currency'de hedef tutar:
 *   - base = from  → targetAmount = amount * rate
 *   - base = to    → targetAmount = amount / rate
 * Eşit currency'de undefined (movements `amount`'u kullanır).
 */
const computedTargetAmount = computed<number | undefined>(() => {
  if (!isCrossCurrency.value) return undefined
  if (!draft.amount || draft.amount <= 0) return undefined
  if (!draft.exchangeRate || draft.exchangeRate <= 0) return undefined
  if (baseCurrency.value === fromCurrency.value)
    return draft.amount * draft.exchangeRate
  return draft.amount / draft.exchangeRate
})

/** Aynı varlık client-side kontrolü (hata mesajları için tek noktada). */
const sameEndpoint = computed(() => {
  if (draft.fromKind !== draft.toKind) return false
  if (draft.fromKind === 'account')
    return !!draft.fromAccountId && draft.fromAccountId === draft.toAccountId
  return !!draft.fromCashRegisterId && draft.fromCashRegisterId === draft.toCashRegisterId
})

const targetPreview = computed<string | undefined>(() => {
  const value = computedTargetAmount.value
  if (value == null) return undefined
  try {
    return new Intl.NumberFormat(
      profileStore.activeProfile?.localeSettings.locale ?? 'tr-TR',
      { style: 'currency', currency: toCurrency.value ?? 'TRY' },
    ).format(value)
  } catch {
    return `${value.toFixed(2)} ${toCurrency.value ?? ''}`
  }
})

/** Cross-currency değilse exchangeRate alanını otomatik temizle. */
watch(isCrossCurrency, (cross) => {
  if (!cross) draft.exchangeRate = undefined
})

async function submit(): Promise<void> {
  const fromId =
    draft.fromKind === 'account' ? draft.fromAccountId : draft.fromCashRegisterId
  const toId = draft.toKind === 'account' ? draft.toAccountId : draft.toCashRegisterId
  if (!fromId) {
    message.error('Kaynak seçimi gerekli.')
    return
  }
  if (!toId) {
    message.error('Hedef seçimi gerekli.')
    return
  }
  if (sameEndpoint.value) {
    message.error('Kaynak ve hedef hesap/kasa aynı olamaz.')
    return
  }
  if (draft.amount <= 0) {
    message.error('Tutar sıfırdan büyük olmalı.')
    return
  }
  if (isCrossCurrency.value) {
    if (!draft.exchangeRate || draft.exchangeRate <= 0) {
      message.error(
        `Dövizli transfer: 1 ${baseCurrency.value} = ? ${quoteCurrency.value} kuru girilmeli.`,
      )
      return
    }
    if (computedTargetAmount.value == null || computedTargetAmount.value <= 0) {
      message.error('Hesaplanan hedef tutar geçersiz; kur ve tutarı kontrol edin.')
      return
    }
  }
  saving.value = true
  try {
    const sourceCurrency = fromCurrency.value ?? props.transfer?.currency ?? profileCurrency()
    const saved = await entities.save<Transfer>('transfer', {
      id: props.transfer?.id,
      fromAccountId: draft.fromKind === 'account' ? draft.fromAccountId : undefined,
      fromCashRegisterId:
        draft.fromKind === 'cashRegister' ? draft.fromCashRegisterId : undefined,
      toAccountId: draft.toKind === 'account' ? draft.toAccountId : undefined,
      toCashRegisterId:
        draft.toKind === 'cashRegister' ? draft.toCashRegisterId : undefined,
      currency: sourceCurrency,
      amount: Number(draft.amount),
      exchangeRate: isCrossCurrency.value ? Number(draft.exchangeRate) : undefined,
      targetAmount: isCrossCurrency.value ? computedTargetAmount.value : undefined,
      date: draft.date.toISOString(),
      description: draft.description.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.transfer ? 'Transfer güncellendi.' : 'Transfer eklendi.')
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
    stack-id="transfer-form"
    :open="open"
    :title="transfer ? 'Transferi düzenle' : 'Yeni transfer'"
    width="min(640px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Kaynak türü" required>
        <RadioGroup v-model:value="draft.fromKind" :options="endpointOptions" />
      </FormItem>

      <FormItem v-if="draft.fromKind === 'account'" label="Kaynak hesap" required>
        <BankAccountSelect
          v-model:value="draft.fromAccountId"
          :accounts="accounts"
          placeholder="Hesap seçin"
          create-label="Yeni hesap"
          @create="fromAccountDrawerOpen = true"
        />
      </FormItem>
      <FormItem v-else label="Kaynak kasa" required>
        <SelectWithCreate
          v-model:value="draft.fromCashRegisterId"
          :options="registers"
          placeholder="Kasa seçin"
          create-label="Yeni kasa"
          @create="fromRegisterDrawerOpen = true"
        />
      </FormItem>

      <FormItem label="Hedef türü" required>
        <RadioGroup v-model:value="draft.toKind" :options="endpointOptions" />
      </FormItem>

      <FormItem v-if="draft.toKind === 'account'" label="Hedef hesap" required>
        <BankAccountSelect
          v-model:value="draft.toAccountId"
          :accounts="accounts"
          placeholder="Hesap seçin"
          create-label="Yeni hesap"
          @create="toAccountDrawerOpen = true"
        />
      </FormItem>
      <FormItem v-else label="Hedef kasa" required>
        <SelectWithCreate
          v-model:value="draft.toCashRegisterId"
          :options="registers"
          placeholder="Kasa seçin"
          create-label="Yeni kasa"
          @create="toRegisterDrawerOpen = true"
        />
      </FormItem>

      <FormItem v-if="sameEndpoint" :colon="false">
        <Alert
          type="warning"
          show-icon
          message="Kaynak ve hedef hesap/kasa aynı seçilemez."
        />
      </FormItem>

      <FormItem
        :label="fromCurrency ? `Tutar (${fromCurrency})` : 'Tutar'"
        required
        :extra="
          isCrossCurrency
            ? `Kaynak hesaptan (${fromCurrency}) çıkacak tutar. Hedef tutar aşağıdaki kura göre hesaplanır.`
            : undefined
        "
      >
        <LocaleInputNumber v-model:value="draft.amount" kind="currency" :min="0" />
      </FormItem>

      <FormItem
        v-if="isCrossCurrency"
        label="Döviz kuru"
        required
        :extra="
          targetPreview
            ? `Hedefe yansıyacak tutar: ${targetPreview}`
            : `1 ${baseCurrency} kaç ${quoteCurrency}? Pozitif bir kur girin.`
        "
      >
        <LocaleInputNumber
          v-model:value="draft.exchangeRate"
          kind="currency"
          :min="0"
          :precision="4"
        >
          <template #addonBefore>1 {{ baseCurrency }} =</template>
          <template #addonAfter>{{ quoteCurrency }}</template>
        </LocaleInputNumber>
      </FormItem>

      <FormItem label="Tarih" required>
        <LocaleDatePicker
          v-model:value="draft.date"
          :disabled-date="disableFutureDates"
          style="width: 100%"
        />
      </FormItem>

      <FormItem label="Açıklama">
        <Input v-model:value="draft.description" placeholder="Örn. Maaş hesabından kasaya çekim" />
      </FormItem>

      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="2" />
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

  <AccountFormDrawer
    v-model:open="fromAccountDrawerOpen"
    @saved="(a) => (draft.fromAccountId = a.id)"
  />
  <CashRegisterFormDrawer
    v-model:open="fromRegisterDrawerOpen"
    @saved="(r) => (draft.fromCashRegisterId = r.id)"
  />
  <AccountFormDrawer
    v-model:open="toAccountDrawerOpen"
    @saved="(a) => (draft.toAccountId = a.id)"
  />
  <CashRegisterFormDrawer
    v-model:open="toRegisterDrawerOpen"
    @saved="(r) => (draft.toCashRegisterId = r.id)"
  />
</template>
