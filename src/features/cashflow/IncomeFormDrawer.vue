<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  DatePicker,
  Switch,
  RadioGroup,
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
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import AccountFormDrawer from '@/features/admin/AccountFormDrawer.vue'
import CashRegisterFormDrawer from '@/features/admin/CashRegisterFormDrawer.vue'
import TypeFormDrawer from '@/features/admin/TypeFormDrawer.vue'
import { disableFutureDates } from '@/core/util/datepicker'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import type {
  Account,
  CashRegister,
  Income,
  IncomeType,
} from '@/core/types/entities'

interface Props {
  open: boolean
  income?: Income | null
}
const props = withDefaults(defineProps<Props>(), { income: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: Income): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()

const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')
const incomeTypes = entities.list<IncomeType>('incomeType')

type TargetKind = 'account' | 'cashRegister'

interface Form {
  incomeTypeId: string | undefined
  targetKind: TargetKind
  accountId: string | undefined
  cashRegisterId: string | undefined
  amount: number
  plannedDate: Dayjs
  realized: boolean
  actualDate: Dayjs | undefined
  description: string
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  return {
    incomeTypeId: undefined,
    targetKind: 'account',
    accountId: undefined,
    cashRegisterId: undefined,
    amount: 0,
    plannedDate: dayjs(),
    realized: false,
    actualDate: undefined,
    description: '',
    notes: '',
    archived: false,
    ...emptySensitiveFields(),
  }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)
const accountDrawerOpen = ref(false)
const registerDrawerOpen = ref(false)
const typeDrawerOpen = ref(false)

function profileCurrency(): string {
  return profileStore.activeProfile?.localeSettings.currency ?? 'TRY'
}

watch(
  () => [props.open, props.income?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.income) {
      Object.assign(draft, {
        incomeTypeId: props.income.incomeTypeId,
        targetKind: props.income.accountId ? 'account' : 'cashRegister',
        accountId: props.income.accountId,
        cashRegisterId: props.income.cashRegisterId,
        amount: props.income.amount,
        plannedDate: dayjs(props.income.plannedDate),
        realized: !!props.income.actualDate,
        actualDate: props.income.actualDate ? dayjs(props.income.actualDate) : undefined,
        description: props.income.description ?? '',
        notes: props.income.notes ?? '',
        archived: !!props.income.archived,
        sensitive: readSensitiveDraft('income', props.income.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

watch(
  () => draft.targetKind,
  (kind) => {
    if (kind === 'account') draft.cashRegisterId = undefined
    else draft.accountId = undefined
  },
)

watch(
  () => draft.realized,
  (r) => {
    if (r && !draft.actualDate) draft.actualDate = draft.plannedDate
    if (!r) draft.actualDate = undefined
  },
)

const targetOptions = computed<{ value: TargetKind; label: string }[]>(() => [
  { value: 'account', label: 'Banka hesabı' },
  { value: 'cashRegister', label: 'Kasa' },
])

function onAccountSaved(a: Account): void {
  draft.accountId = a.id
}
function onRegisterSaved(r: CashRegister): void {
  draft.cashRegisterId = r.id
}

async function submit(): Promise<void> {
  if (draft.targetKind === 'account' && !draft.accountId) {
    message.error('Banka hesabı seçimi gerekli.')
    return
  }
  if (draft.targetKind === 'cashRegister' && !draft.cashRegisterId) {
    message.error('Kasa seçimi gerekli.')
    return
  }
  if (draft.amount <= 0) {
    message.error('Tutar sıfırdan büyük olmalı.')
    return
  }
  if (draft.realized && !draft.actualDate) {
    message.error('Tahsil tarihi gerekli.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<Income>('income', {
      id: props.income?.id,
      incomeTypeId: draft.incomeTypeId || undefined,
      accountId: draft.targetKind === 'account' ? draft.accountId : undefined,
      cashRegisterId:
        draft.targetKind === 'cashRegister' ? draft.cashRegisterId : undefined,
      currency: props.income?.currency ?? profileCurrency(),
      amount: Number(draft.amount),
      plannedDate: draft.plannedDate.toISOString(),
      actualDate: draft.realized ? draft.actualDate!.toISOString() : undefined,
      description: draft.description.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.income ? 'Gelir güncellendi.' : 'Gelir eklendi.')
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
    stack-id="income-form"
    :open="open"
    :title="income ? 'Geliri düzenle' : 'Yeni gelir'"
    width="min(600px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Gelir türü">
        <SelectWithCreate
          v-model:value="draft.incomeTypeId"
          :options="incomeTypes"
          placeholder="Tür seçin (opsiyonel)"
          create-label="Yeni tür"
          @create="typeDrawerOpen = true"
        />
      </FormItem>

      <FormItem label="Hedef" required>
        <RadioGroup v-model:value="draft.targetKind" :options="targetOptions" />
      </FormItem>

      <FormItem v-if="draft.targetKind === 'account'" label="Banka hesabı" required>
        <SelectWithCreate
          v-model:value="draft.accountId"
          :options="accounts"
          placeholder="Hesap seçin"
          create-label="Yeni hesap"
          @create="accountDrawerOpen = true"
        />
      </FormItem>
      <FormItem v-else label="Kasa" required>
        <SelectWithCreate
          v-model:value="draft.cashRegisterId"
          :options="registers"
          placeholder="Kasa seçin"
          create-label="Yeni kasa"
          @create="registerDrawerOpen = true"
        />
      </FormItem>

      <FormItem label="Tutar" required>
        <LocaleInputNumber v-model:value="draft.amount" kind="currency" :min="0" />
      </FormItem>

      <FormItem label="Açıklama">
        <Input v-model:value="draft.description" placeholder="Örn. Maaş — Mayıs" />
      </FormItem>

      <FormItem label="Plan tarihi" required>
        <DatePicker v-model:value="draft.plannedDate" style="width: 100%" />
      </FormItem>

      <FormItem label="Gerçekleşti">
        <Switch v-model:checked="draft.realized" />
      </FormItem>

      <FormItem v-if="draft.realized" label="Tahsil tarihi" required>
        <DatePicker
          v-model:value="draft.actualDate"
          :disabled-date="disableFutureDates"
          style="width: 100%"
        />
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

  <AccountFormDrawer v-model:open="accountDrawerOpen" @saved="onAccountSaved" />
  <CashRegisterFormDrawer v-model:open="registerDrawerOpen" @saved="onRegisterSaved" />
  <TypeFormDrawer
    v-model:open="typeDrawerOpen"
    entity-type="incomeType"
    title="Gelir türü"
    :item="null"
    @saved="(t) => (draft.incomeTypeId = t.id)"
  />
</template>
