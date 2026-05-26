<script setup lang="ts">
import { DatePicker } from 'ant-design-vue'
import { CalendarOutlined } from '@ant-design/icons-vue'
import type { Dayjs } from 'dayjs'
import { computed, useAttrs } from 'vue'
import KpMobileFullscreenSheet from '@/components/KpMobileFullscreenSheet.vue'
import KpMobileRangePickerPanel from '@/components/KpMobileRangePickerPanel.vue'
import { useLocaleDatePicker } from '@/composables/useLocaleDatePicker'
import { useMobilePickerSheet } from '@/composables/useMobilePickerSheet'
import { useMobileViewport } from '@/composables/useMatchMedia'
import { localePickerBindFromAttrs, localePickerShellAttrs } from '@/core/util/locale-picker-bind'
import {
  formatPickerRangeDisplay,
  normalizePickerDayjs,
} from '@/core/util/picker-display'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  value?: [Dayjs, Dayjs] | [string, string] | null
}>()

const emit = defineEmits<{
  'update:value': [value: [Dayjs, Dayjs] | [string, string] | null | undefined]
}>()

const attrs = useAttrs()
const isMobileViewport = useMobileViewport()
const { format } = useLocaleDatePicker()
const { sheetOpen, openSheet, closeSheet, onSheetAfterLeave } = useMobilePickerSheet()

type TriggerAttrs = {
  disabled?: boolean
  allowClear?: boolean
  placeholder?: string | [string, string]
  mobileTitle?: string
  size?: 'small' | 'middle' | 'large'
}

const triggerAttrs = computed(() => attrs as TriggerAttrs)

const disabled = computed(() => !!triggerAttrs.value.disabled)
const allowClear = computed(() => !!triggerAttrs.value.allowClear)
const placeholder = computed(() => {
  const raw = triggerAttrs.value.placeholder
  if (Array.isArray(raw)) return raw.join(' – ')
  return raw ?? 'Tarih aralığı seçin'
})
const sheetTitle = computed(() => triggerAttrs.value.mobileTitle ?? placeholder.value)

const displayText = computed(() => formatPickerRangeDisplay(props.value, format.value))

const panelValue = computed((): [Dayjs, Dayjs] | null => {
  const current = props.value
  if (!current?.[0] || !current[1]) return null
  const start = normalizePickerDayjs(current[0])
  const end = normalizePickerDayjs(current[1])
  return start && end ? [start, end] : null
})

const pickerBind = computed(() =>
  localePickerBindFromAttrs(attrs as Record<string, unknown>, format.value),
)

const shellBind = computed(() =>
  localePickerShellAttrs(attrs as Record<string, unknown>),
)

const desktopBind = computed(() => ({
  ...pickerBind.value,
  ...shellBind.value,
  value: props.value ?? undefined,
}))

function emitValue(
  raw: [Dayjs, Dayjs] | [string, string] | null | undefined,
): void {
  emit('update:value', raw ?? null)
}

function onTriggerClick(): void {
  if (disabled.value) return
  openSheet()
}

function onPanelChange(value: [Dayjs, Dayjs] | null): void {
  if (!value?.[0] || !value[1]) return
  emitValue(value)
  closeSheet()
}

function clearValue(event: Event): void {
  event.stopPropagation()
  emitValue(null)
}
</script>

<template>
  <DatePicker.RangePicker
    v-if="!isMobileViewport"
    v-bind="desktopBind"
    @update:value="(value) => emitValue(value ?? null)"
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>
  </DatePicker.RangePicker>

  <template v-else>
    <button
      type="button"
      class="kp-picker-trigger"
      :style="shellBind.style"
      :class="[
        shellBind.class,
        {
          'kp-picker-trigger--disabled': disabled,
          'kp-picker-trigger--sm': triggerAttrs.size === 'small',
          'kp-picker-trigger--placeholder': !displayText,
        },
      ]"
      :disabled="disabled"
      :aria-label="displayText || placeholder"
      @click="onTriggerClick"
    >
      <span class="kp-picker-trigger__value">
        {{ displayText || placeholder }}
      </span>
      <span class="kp-picker-trigger__icons">
        <span
          v-if="allowClear && displayText && !disabled"
          class="kp-picker-trigger__clear"
          role="button"
          tabindex="-1"
          aria-label="Temizle"
          @click="clearValue"
        >
          ×
        </span>
        <CalendarOutlined class="kp-picker-trigger__icon" />
      </span>
    </button>

    <KpMobileFullscreenSheet
      :open="sheetOpen"
      :title="sheetTitle"
      variant="range"
      @close="closeSheet"
      @after-leave="onSheetAfterLeave"
    >
      <KpMobileRangePickerPanel
        :value="panelValue"
        :picker-bind="pickerBind"
        @change="onPanelChange"
      />
    </KpMobileFullscreenSheet>
  </template>
</template>

<style scoped>
.kp-picker-trigger {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
  padding: 0 11px;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: var(--ant-border-radius, 6px);
  background: var(--ant-color-bg-container, #fff);
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  font-size: 14px;
  line-height: 1.5715;
  text-align: left;
  cursor: pointer;
}

.kp-picker-trigger--sm {
  min-height: 24px;
  padding: 0 7px;
}

.kp-picker-trigger--placeholder .kp-picker-trigger__value {
  color: var(--ant-color-text-placeholder, rgba(0, 0, 0, 0.25));
}

.kp-picker-trigger--disabled {
  color: var(--ant-color-text-disabled, rgba(0, 0, 0, 0.25));
  background: var(--ant-color-bg-container-disabled, rgba(0, 0, 0, 0.04));
  cursor: not-allowed;
}

.kp-picker-trigger__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-picker-trigger__icons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex-shrink: 0;
  color: var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25));
}

.kp-picker-trigger__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 14px;
  line-height: 1;
}

.kp-picker-trigger__icon {
  font-size: 14px;
}

[data-theme='dark'] .kp-picker-trigger {
  background: var(--ant-color-bg-container, #141414);
  border-color: var(--ant-color-border, #424242);
}
</style>
