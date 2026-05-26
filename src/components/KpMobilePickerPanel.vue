<script setup lang="ts">
import { DatePicker } from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  value?: Dayjs | null
  pickerBind: Record<string, unknown>
}>()

const emit = defineEmits<{
  change: [value: Dayjs | null]
}>()

const hostRef = ref<HTMLElement | null>(null)
const hostReady = ref(false)
const panelOpen = ref(false)

const datePickerBind = computed(() => ({
  ...props.pickerBind,
  value: props.value ?? undefined,
}))

onMounted(async () => {
  await nextTick()
  hostReady.value = true
  panelOpen.value = true
})

watch(
  () => props.value,
  () => {
    panelOpen.value = true
  },
)

watch(
  () => props.pickerBind,
  () => {
    panelOpen.value = true
  },
  { deep: true },
)

function getPopupContainer(): HTMLElement {
  return hostRef.value ?? document.body
}

function onOpenChange(open: boolean): void {
  if (!open) panelOpen.value = true
}

function onChange(raw: Dayjs | string | null): void {
  if (raw == null || raw === '') {
    emit('change', null)
    return
  }
  const next = typeof raw === 'string' ? null : raw
  emit('change', next)
}
</script>

<template>
  <div ref="hostRef" class="kp-mobile-picker-panel">
    <DatePicker
      v-if="hostReady"
      v-bind="datePickerBind"
      v-model:open="panelOpen"
      :get-popup-container="getPopupContainer"
      input-read-only
      @open-change="onOpenChange"
      @update:value="onChange"
    />
  </div>
</template>

<style scoped>
.kp-mobile-picker-panel {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
}

.kp-mobile-picker-panel :deep(.ant-picker) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.kp-mobile-picker-panel :deep(.ant-picker-dropdown) {
  position: static !important;
  inset: auto !important;
  transform: none !important;
  padding: 0;
}

.kp-mobile-picker-panel :deep(.ant-picker-panel-container) {
  box-shadow: none;
}
</style>
