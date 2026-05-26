<script setup lang="ts" generic="T extends { id: string; name: string; archived?: boolean }">
import { computed, useTemplateRef } from 'vue'
import { Button } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import KpSelect from '@/components/KpSelect.vue'

interface Props {
  value?: string
  options: T[]
  placeholder?: string
  allowCreate?: boolean
  createLabel?: string
  disabled?: boolean
  showArchived?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Seçim yapın',
  allowCreate: true,
  createLabel: 'Yeni kayıt',
  disabled: false,
  showArchived: false,
})

const emit = defineEmits<{
  (e: 'update:value', value: string | undefined): void
  (e: 'create'): void
}>()

const kpSelectRef = useTemplateRef<InstanceType<typeof KpSelect>>('kpSelectRef')

const visibleOptions = computed<T[]>(() =>
  props.showArchived ? props.options : props.options.filter((opt) => !opt.archived),
)

const selectOptions = computed(() =>
  visibleOptions.value.map((opt) => ({ value: opt.id, label: opt.name })),
)

function filterOption(input: string, option: unknown): boolean {
  const opt = option as { label?: string; children?: unknown }
  const text = String(opt.label ?? '').toLowerCase()
  return text.includes(input.toLowerCase())
}

function update(value: unknown): void {
  emit('update:value', value == null ? undefined : String(value))
}

function onCreate(): void {
  kpSelectRef.value?.closeSheet()
  emit('create')
}
</script>

<template>
  <KpSelect
    ref="kpSelectRef"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    show-search
    allow-clear
    :filter-option="filterOption"
    :options="selectOptions"
    @update:value="update"
  >
    <template v-if="allowCreate" #footer>
      <div class="kp-select-create">
        <Button type="link" block @click="onCreate">
          <template #icon><PlusOutlined /></template>
          {{ createLabel }}
        </Button>
      </div>
    </template>
  </KpSelect>
</template>

<style scoped>
.kp-select-create {
  padding: 0;
}
</style>
