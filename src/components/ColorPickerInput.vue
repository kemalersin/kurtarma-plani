<script setup lang="ts">
import { computed } from 'vue'
import { Button, Input } from 'ant-design-vue'
import { hexForColorInput, normalizeHexColor } from '@/core/util/color'

interface Props {
  modelValue?: string
  /** Renk seçilmemişken picker'da gösterilecek önizleme */
  defaultPreview?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  defaultPreview: '#1677ff',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const pickerValue = computed(() => hexForColorInput(props.modelValue, props.defaultPreview))

const hasColor = computed(() => !!normalizeHexColor(props.modelValue))

function onPickerInput(event: Event): void {
  const hex = (event.target as HTMLInputElement).value
  emit('update:modelValue', hex)
}

function clearColor(): void {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="kp-color-picker">
    <label class="kp-color-picker__native" :aria-label="'Renk seç'">
      <input
        type="color"
        class="kp-color-picker__input"
        :value="pickerValue"
        @input="onPickerInput"
      />
      <span class="kp-color-picker__preview" :style="{ backgroundColor: pickerValue }" />
    </label>
    <Input
      class="kp-color-picker__hex"
      :value="modelValue"
      placeholder="#1677ff"
      allow-clear
      @update:value="emit('update:modelValue', $event ?? '')"
    />
    <Button v-if="hasColor" type="link" size="small" @click="clearColor">
      Temizle
    </Button>
  </div>
</template>

<style scoped>
.kp-color-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.kp-color-picker__native {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  cursor: pointer;
}

.kp-color-picker__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.kp-color-picker__preview {
  display: block;
  width: 36px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
}

[data-theme='dark'] .kp-color-picker__preview {
  border-color: rgba(255, 255, 255, 0.2);
}

.kp-color-picker__hex {
  flex: 1 1 120px;
  min-width: 0;
  max-width: 160px;
}
</style>
