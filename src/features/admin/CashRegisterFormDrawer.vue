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
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useAccountBalances } from '@/features/cashflow/useAccountBalances'
import { SUPPORTED_CURRENCIES } from '@/core/locale/defaults'
import type { CashRegister } from '@/core/types/entities'

interface Props {
  open: boolean
  register?: CashRegister | null
  /** Borç ödemesi kaynağından açılırsa para birimi profil yereline kilitlenir. */
  lockCurrency?: boolean
}

const props = withDefaults(defineProps<Props>(), { register: null, lockCurrency: false })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: CashRegister): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()

interface Form {
  name: string
  currency: string
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
    name: '',
    currency: profileCurrency(),
    openingBalance: 0,
    openingDate: dayjs(),
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)

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
 * Kasaya ait gerçekleşmiş hareket varsa currency kilitli — bakiye motorunun
 * geriye dönük yanlış yorumlamasını engeller.
 */
const hasMovements = computed<boolean>(() => {
  if (!props.register) return false
  const id = props.register.id
  return movements.value.some((m) => m.cashRegisterId === id)
})

watch(
  () => [props.open, props.register?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.register) {
      Object.assign(draft, {
        name: props.register.name,
        currency: props.register.currency,
        openingBalance: props.register.openingBalance,
        openingDate: dayjs(props.register.openingDate),
        notes: props.register.notes ?? '',
        archived: !!props.register.archived,
        sensitive: readSensitiveDraft('cashRegister', props.register.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

async function submit(): Promise<void> {
  if (!draft.name.trim()) {
    message.error('Kasa adı gerekli.')
    return
  }
  saving.value = true
  try {
    const code = (props.lockCurrency ? profileCurrency() : draft.currency || profileCurrency()).toUpperCase()
    if (code.length !== 3) {
      message.error('Para birimi 3 harfli kod olmalı (örn. TRY, USD).')
      return
    }
    if (hasMovements.value && props.register && code !== props.register.currency) {
      message.error('Bu kasaya ait hareketler olduğu için para birimi değiştirilemez.')
      return
    }
    const saved = await entities.save<CashRegister>('cashRegister', {
      id: props.register?.id,
      name: draft.name.trim(),
      currency: code,
      openingBalance: Number(draft.openingBalance) || 0,
      openingDate: draft.openingDate.toISOString(),
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.register ? 'Kasa güncellendi.' : 'Kasa eklendi.')
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
    stack-id="cash-register-form"
    :open="open"
    :title="register ? 'Kasayı düzenle' : 'Yeni kasa'"
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Kasa adı" required>
        <Input v-model:value="draft.name" placeholder="Örn. Nakit kasası" />
      </FormItem>
      <FormItem
        v-if="!lockCurrency"
        label="Para birimi"
        required
        :extra="
          hasMovements
            ? 'Bu kasaya ait gerçekleşmiş hareketler olduğu için para birimi değiştirilemez.'
            : isProfileCurrency
              ? undefined
              : 'Dövizli kasa: borç ödemeleri için kullanılamaz; yalnız gelir / gider / transfer kaydedilebilir.'
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
</template>
