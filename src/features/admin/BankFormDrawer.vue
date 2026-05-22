<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  Form,
  FormItem,
  Input,
  Textarea,
  Switch,
  Space,
  Button,
  message,
} from 'ant-design-vue'
import FormDrawer from '@/components/FormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import type { Bank } from '@/core/types/entities'

interface Props {
  open: boolean
  bank?: Bank | null
}

const props = withDefaults(defineProps<Props>(), { bank: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: Bank): void
}>()

const entities = useEntitiesStore()

interface Form {
  name: string
  shortName: string
  bicSwift: string
  branchCode: string
  notes: string
  archived: boolean
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)

function emptyForm(): Form {
  return {
    name: '',
    shortName: '',
    bicSwift: '',
    branchCode: '',
    notes: '',
    archived: false,
  }
}

watch(
  () => [props.open, props.bank?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.bank) {
      Object.assign(draft, {
        name: props.bank.name,
        shortName: props.bank.shortName ?? '',
        bicSwift: props.bank.bicSwift ?? '',
        branchCode: props.bank.branchCode ?? '',
        notes: props.bank.notes ?? '',
        archived: !!props.bank.archived,
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

async function submit(): Promise<void> {
  if (!draft.name.trim()) {
    message.error('Banka adı gerekli.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<Bank>('bank', {
      id: props.bank?.id,
      name: draft.name.trim(),
      shortName: draft.shortName.trim() || undefined,
      bicSwift: draft.bicSwift.trim() || undefined,
      branchCode: draft.branchCode.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    })
    message.success(props.bank ? 'Banka güncellendi.' : 'Banka eklendi.')
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
    stack-id="bank-form"
    :open="open"
    :title="bank ? 'Bankayı düzenle' : 'Yeni banka'"
    width="min(560px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Banka adı" required>
        <Input v-model:value="draft.name" placeholder="Örn. Türkiye İş Bankası" />
      </FormItem>
      <FormItem label="Kısa ad">
        <Input v-model:value="draft.shortName" placeholder="İş Bankası" />
      </FormItem>
      <FormItem label="BIC / SWIFT">
        <Input v-model:value="draft.bicSwift" placeholder="ISBKTRIS" />
      </FormItem>
      <FormItem label="Şube kodu">
        <Input v-model:value="draft.branchCode" />
      </FormItem>
      <FormItem label="Notlar">
        <Textarea v-model:value="draft.notes" :rows="3" />
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
</template>
