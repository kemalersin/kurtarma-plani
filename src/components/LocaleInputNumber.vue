<script setup lang="ts">
import { InputNumber } from 'ant-design-vue'
import { computed, useAttrs } from 'vue'
import {
  useLocaleNumberInput,
  type LocaleNumberInputKind,
} from '@/composables/useLocaleNumberInput'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  kind: LocaleNumberInputKind
  value?: number | null
  /**
   * Opsiyonel: locale tabanlı precision'ı override eder (örn. döviz kuru
   * gibi 4-6 ondalık gereken alanlarda). Verilmezse `kind`'a göre
   * profile/currency tabanlı varsayılan kullanılır.
   */
  precision?: number
}>()

const emit = defineEmits<{
  'update:value': [value: number | null | undefined]
}>()

const attrs = useAttrs()
const { inputProps } = useLocaleNumberInput(props.kind)

const bindProps = computed(() => {
  const locale = inputProps.value
  const overridden = props.precision != null
    ? {
        ...locale,
        precision: props.precision,
        step: props.precision <= 0 ? 1 : 10 ** -props.precision,
      }
    : locale
  return {
    ...attrs,
    ...overridden,
    value: props.value ?? undefined,
  }
})
</script>

<template>
  <InputNumber
    v-bind="bindProps"
    style="width: 100%"
    @update:value="
      (value) => {
        if (value == null || value === '') emit('update:value', undefined)
        else if (typeof value === 'number') emit('update:value', value)
        else emit('update:value', Number(value))
      }
    "
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>
  </InputNumber>
</template>
