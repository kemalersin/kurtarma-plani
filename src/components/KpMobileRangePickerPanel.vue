<script setup lang="ts">
import { DatePicker } from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  value?: [Dayjs, Dayjs] | null
  pickerBind: Record<string, unknown>
}>()

const emit = defineEmits<{
  change: [value: [Dayjs, Dayjs] | null]
}>()

const hostRef = ref<HTMLElement | null>(null)
const hostReady = ref(false)
const panelOpen = ref(false)

const rangePickerBind = computed(() => ({
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

function onChange(raw: [Dayjs, Dayjs] | [string, string] | null): void {
  if (!raw?.[0] || !raw[1]) {
    emit('change', null)
    return
  }
  if (typeof raw[0] === 'string' || typeof raw[1] === 'string') {
    emit('change', null)
    return
  }
  emit('change', [raw[0], raw[1]])
}
</script>

<template>
  <div ref="hostRef" class="kp-mobile-picker-panel">
    <DatePicker.RangePicker
      v-if="hostReady"
      v-bind="rangePickerBind"
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
