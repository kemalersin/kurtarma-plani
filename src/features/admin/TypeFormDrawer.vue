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
import ColorPickerInput from '@/components/ColorPickerInput.vue'
import FormDrawer from '@/components/FormDrawer.vue'
import SensitiveRecordSwitch from '@/components/SensitiveRecordSwitch.vue'
import {
  emptySensitiveFields,
  readSensitiveDraft,
  sensitiveSaveOptions,
} from '@/composables/useSensitiveEntityForm'
import { normalizeHexColor } from '@/core/util/color'
import { useEntitiesStore } from '@/stores/entities'
import type { EntityType } from '@/core/db/profile-db'
import type { IncomeType, ExpenseType } from '@/core/types/entities'

type ParametricEntity = IncomeType | ExpenseType

interface Props {
  open: boolean
  entityType: EntityType
  title: string
  item?: ParametricEntity | null
}

const props = withDefaults(defineProps<Props>(), { item: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', value: ParametricEntity): void
}>()

const entities = useEntitiesStore()

interface Form {
  name: string
  color: string
  notes: string
  archived: boolean
  sensitive: boolean
}

function emptyForm(): Form {
  return { name: '', color: '', notes: '', archived: false, ...emptySensitiveFields() }
}

const draft = reactive<Form>(emptyForm())
const saving = ref(false)

watch(
  () => [props.open, props.item?.id] as const,
  ([open]) => {
    if (!open) return
    if (props.item) {
      Object.assign(draft, {
        name: props.item.name,
        color: props.item.color ?? '',
        notes: props.item.notes ?? '',
        archived: !!props.item.archived,
        sensitive: readSensitiveDraft(props.entityType, props.item.id),
      })
    } else {
      Object.assign(draft, emptyForm())
    }
  },
)

async function submit(): Promise<void> {
  if (!draft.name.trim()) {
    message.error('Ad gerekli.')
    return
  }
  saving.value = true
  try {
    const saved = await entities.save<ParametricEntity>(props.entityType, {
      id: props.item?.id,
      name: draft.name.trim(),
      color: normalizeHexColor(draft.color),
      notes: draft.notes.trim() || undefined,
      archived: draft.archived || undefined,
    }, sensitiveSaveOptions(draft))
    message.success(props.item ? 'Güncellendi.' : 'Eklendi.')
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
    :stack-id="`type-form-${entityType}`"
    :open="open"
    :title="item ? `${title} (düzenle)` : `${title} (yeni)`"
    width="min(520px, 100vw)"
    :mask-closable="!saving"
    @update:open="emit('update:open', $event)"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submit">
      <FormItem label="Ad" required>
        <Input v-model:value="draft.name" />
      </FormItem>
      <FormItem label="Renk">
        <ColorPickerInput v-model="draft.color" />
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
