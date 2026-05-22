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
  Expense,
  ExpenseType,
} from '@/core/types/entities'

interface Props {
  open: boolean
  expense?: Expense | null
}
const props = withDefaults(defineProps<Props>(), { expense: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: Expense): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()

const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')
const expenseTypes = entities.list<ExpenseType>('expenseType')

type SourceKind = 'account' | 'cashRegister'

interface Form {
  expenseTypeId: string | undefined
  sourceKind: SourceKind
  accountId: string | undefined
  cashRegisterId: string | undefined
  amount: number
  plannedDate: Dayjs
  realized: boolean
  actualDate: Dayjs | undefined
  description: string
  notes: string
  archived: boolean
}

function emptyForm(): Form {
  return {
    expenseTypeId: undefined,
    sourceKind: 'account',
    accountId: undefined,
    cashRegisterId: undefined,
    amount: 0,
    plannedDate: dayjs(),
    realized: false,
    actualDate: undefined,
    description: '',
    notes: '',
    archived: false,
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
  () => [props.open, props.expense?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.expense) {
      Object.assign(draft, {
        expenseTypeId: props.expense.expenseTypeId,
        sourceKind: props.expense.accountId ? 'account' : 'cashRegister',
        accountId: props.expense.accountId,
        cashRegisterId: props.expense.cashRegisterId,
        amount: props.expense.amount,
        plannedDate: dayjs(props.expense.plannedDate),
        realized: !!props.expense.actualDate,
        actualDate: props.expense.actualDate ? dayjs(props.expense.actualDate) : undefined,
        description: props.expense.description ?? '',
        notes: props.expense.notes ?? '',
        archived: !!props.expense.archived,
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

watch(
  () => draft.sourceKind,
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

const sourceOptions = computed<{ value: SourceKind; label: string }[]>(() => [
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
  if (draft.sourceKind === 'account' && !draft.accountId) {
    message.error('Banka hesabı seçimi gerekli.')
    return
  }
  if (draft.sourceKind === 'cashRegister' && !draft.cashRegisterId) {
    message.error('Kasa seçimi gerekli.')
    return
  }
  if (draft.amount <= 0) {
    message.error('Tutar sıfırdan büyük olmalı.')
    return
  }
  if (draft.realized && !draft.actualDate) {
    message.error('Ödeme tarihi gerekli.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<Expense>('expense', {
      id: props.expense?.id,
      expenseTypeId: draft.expenseTypeId || undefined,
      accountId: draft.sourceKind === 'account' ? draft.accountId : undefined,
      cashRegisterId:
        draft.sourceKind === 'cashRegister' ? draft.cashRegisterId : undefined,
      currency: props.expense?.currency ?? profileCurrency(),
      amount: Number(draft.amount),
      plannedDate: draft.plannedDate.toISOString(),
      actualDate: draft.realized ? draft.actualDate!.toISOString() : undefined,
      description: draft.description.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    })
    message.success(props.expense ? 'Gider güncellendi.' : 'Gider eklendi.')
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
    stack-id="expense-form"
    :open="open"
    :title="expense ? 'Gideri düzenle' : 'Yeni gider'"
    width="min(600px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Gider türü">
        <SelectWithCreate
          v-model:value="draft.expenseTypeId"
          :options="expenseTypes"
          placeholder="Tür seçin (opsiyonel)"
          create-label="Yeni tür"
          @create="typeDrawerOpen = true"
        />
      </FormItem>

      <FormItem label="Kaynak" required>
        <RadioGroup v-model:value="draft.sourceKind" :options="sourceOptions" />
      </FormItem>

      <FormItem v-if="draft.sourceKind === 'account'" label="Banka hesabı" required>
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
        <Input v-model:value="draft.description" placeholder="Örn. Market — Migros" />
      </FormItem>

      <FormItem label="Plan tarihi" required>
        <DatePicker v-model:value="draft.plannedDate" style="width: 100%" />
      </FormItem>

      <FormItem label="Gerçekleşti">
        <Switch v-model:checked="draft.realized" />
      </FormItem>

      <FormItem v-if="draft.realized" label="Ödeme tarihi" required>
        <DatePicker
          v-model:value="draft.actualDate"
          :disabled-date="disableFutureDates"
          style="width: 100%"
        />
      </FormItem>

      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="2" />
      </FormItem>

      <FormItem label="Arşivli">
        <Switch v-model:checked="draft.archived" />
      </FormItem>
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
    entity-type="expenseType"
    title="Gider türü"
    :item="null"
    @saved="(t) => (draft.expenseTypeId = t.id)"
  />
</template>
