<script setup lang="ts">
import { DatePicker } from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, useAttrs } from 'vue'
import { useLocaleDatePicker } from '@/composables/useLocaleDatePicker'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  value?: Dayjs | string | null
}>()

const emit = defineEmits<{
  'update:value': [value: Dayjs | string | null | undefined]
}>()

const attrs = useAttrs()
const { format } = useLocaleDatePicker()

const bindProps = computed(() => ({
  ...attrs,
  format: format.value,
  value: props.value ?? undefined,
}))
</script>

<template>
  <DatePicker
    v-bind="bindProps"
    @update:value="(value) => emit('update:value', value ?? null)"
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>
  </DatePicker>
</template>
