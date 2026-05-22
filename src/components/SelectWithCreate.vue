<script setup lang="ts" generic="T extends { id: string; name: string; archived?: boolean }">
import { computed } from 'vue'
import { Select, Button, Divider } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'

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

const visibleOptions = computed<T[]>(() =>
  props.showArchived ? props.options : props.options.filter((opt) => !opt.archived),
)

function filterOption(input: string, option: unknown): boolean {
  const opt = option as { label?: string; children?: unknown }
  const text = String(opt.label ?? '').toLowerCase()
  return text.includes(input.toLowerCase())
}

function update(value: unknown): void {
  emit('update:value', value == null ? undefined : String(value))
}
</script>

<template>
  <Select
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    show-search
    :filter-option="filterOption"
    :options="visibleOptions.map((opt) => ({ value: opt.id, label: opt.name }))"
    allow-clear
    @update:value="update"
  >
    <template v-if="allowCreate" #dropdownRender="{ menuNode }">
      <component :is="menuNode" />
      <Divider style="margin: 4px 0" />
      <div class="kp-select-create" @mousedown.prevent>
        <Button type="link" block @click="emit('create')">
          <template #icon><PlusOutlined /></template>
          {{ createLabel }}
        </Button>
      </div>
    </template>
  </Select>
</template>

<style scoped>
.kp-select-create {
  padding: 4px 8px;
}
</style>
