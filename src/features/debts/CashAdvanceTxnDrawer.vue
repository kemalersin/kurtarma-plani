<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  DatePicker,
  Select,
  Textarea,
  Space,
  Button,
  Popconfirm,
  message,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import FormDrawer from '@/components/FormDrawer.vue'
import LocaleInputNumber from '@/components/LocaleInputNumber.vue'
import PaymentSourcePicker from '@/components/PaymentSourcePicker.vue'
import { useEntitiesStore } from '@/stores/entities'
import { disableFutureDates } from '@/core/util/datepicker'
import type {
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CashAdvanceTxnType,
} from '@/core/types/entities'

interface Props {
  open: boolean
  account: CashAdvanceAccount | null
  txn?: CashAdvanceTransaction | null
}
const props = withDefaults(defineProps<Props>(), { txn: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const entities = useEntitiesStore()

const typeOptions = computed<{ value: CashAdvanceTxnType; label: string }[]>(() => [
  { value: 'draw', label: 'Kullanım' },
  { value: 'payment', label: 'Ödeme' },
])

interface Form {
  date: Dayjs
  type: CashAdvanceTxnType
  amount: number
  sourceAccountId: string | undefined
  sourceCashRegisterId: string | undefined
  targetAccountId: string | undefined
  targetCashRegisterId: string | undefined
  description: string
  notes: string
}

const draft = reactive<Form>({
  date: dayjs(),
  type: 'draw',
  amount: 0,
  sourceAccountId: undefined,
  sourceCashRegisterId: undefined,
  targetAccountId: undefined,
  targetCashRegisterId: undefined,
  description: '',
  notes: '',
})
const saving = ref(false)

watch(
  () => [props.open, props.txn?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.txn) {
      draft.date = dayjs(props.txn.date)
      draft.type = props.txn.type
      draft.amount = props.txn.amount
      draft.sourceAccountId = props.txn.sourceAccountId
      draft.sourceCashRegisterId = props.txn.sourceCashRegisterId
      draft.targetAccountId = props.txn.targetAccountId
      draft.targetCashRegisterId = props.txn.targetCashRegisterId
      draft.description = props.txn.description ?? ''
      draft.notes = props.txn.notes ?? ''
    } else {
      draft.date = dayjs()
      draft.type = 'draw'
      draft.amount = 0
      draft.sourceAccountId = undefined
      draft.sourceCashRegisterId = undefined
      draft.targetAccountId = undefined
      draft.targetCashRegisterId = undefined
      draft.description = ''
      draft.notes = ''
    }
  },
)

async function submit(): Promise<void> {
  if (!props.account) return
  if (draft.amount <= 0) {
    message.error('Tutar sıfırdan büyük olmalı.')
    return
  }
  saving.value = true
  try {
    await entities.save<CashAdvanceTransaction>('cashAdvanceTransaction', {
      id: props.txn?.id,
      accountId: props.account.id,
      date: draft.date.toISOString(),
      type: draft.type,
      amount: Number(draft.amount),
      sourceAccountId: draft.type === 'payment' ? draft.sourceAccountId : undefined,
      sourceCashRegisterId:
        draft.type === 'payment' ? draft.sourceCashRegisterId : undefined,
      targetAccountId: draft.type === 'draw' ? draft.targetAccountId : undefined,
      targetCashRegisterId:
        draft.type === 'draw' ? draft.targetCashRegisterId : undefined,
      description: draft.description.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    })
    message.success(props.txn ? 'Hareket güncellendi.' : 'Hareket eklendi.')
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.txn) return
  saving.value = true
  try {
    await entities.remove('cashAdvanceTransaction', props.txn.id)
    message.success('Hareket silindi.')
    emit('saved')
    emit('update:open', false)
  } catch {
    message.error('Silinemedi.')
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
    stack-id="cash-advance-txn"
    :open="open"
    :title="txn ? 'Hareketi düzenle' : 'Yeni hareket'"
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Tarih" required>
        <DatePicker
          v-model:value="draft.date"
          :disabled-date="disableFutureDates"
          style="width: 100%"
        />
      </FormItem>
      <FormItem label="Tür" required>
        <Select v-model:value="draft.type" :options="typeOptions" />
      </FormItem>
      <FormItem label="Tutar" required>
        <LocaleInputNumber v-model:value="draft.amount" kind="currency" :min="0" />
      </FormItem>

      <PaymentSourcePicker
        v-if="draft.type === 'payment'"
        v-model:accountId="draft.sourceAccountId"
        v-model:cashRegisterId="draft.sourceCashRegisterId"
        label="Ödendiği hesap / kasa"
        hint="Boş bırakılırsa cashflow bakiyesinden düşmez."
      />
      <PaymentSourcePicker
        v-if="draft.type === 'draw'"
        v-model:accountId="draft.targetAccountId"
        v-model:cashRegisterId="draft.targetCashRegisterId"
        kind="target"
        label="Çekilen nakit hesabı / kasası"
        hint="Boş bırakılırsa cashflow bakiyesine eklenmez."
      />

      <FormItem label="Açıklama">
        <Input v-model:value="draft.description" />
      </FormItem>
      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="2" />
      </FormItem>

      <div v-if="txn" class="kp-form-drawer-danger-row">
        <Popconfirm
          placement="topRight"
          overlay-class-name="kp-popoverlay-edge"
          title="Bu hareket silinsin mi?"
          ok-text="Sil"
          cancel-text="Vazgeç"
          :ok-button-props="{ danger: true }"
          @confirm="remove"
        >
          <Button danger ghost size="small" :loading="saving">Sil</Button>
        </Popconfirm>
      </div>
    </Form>

    <template #extra>
      <Space>
        <Button :disabled="saving" @click="close">Vazgeç</Button>
        <Button type="primary" :loading="saving" @click="submit">Kaydet</Button>
      </Space>
    </template>
  </FormDrawer>
</template>
