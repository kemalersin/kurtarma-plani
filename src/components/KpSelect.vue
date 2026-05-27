<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, useSlots, watch } from 'vue'
import { Select, Input, Divider, Empty } from 'ant-design-vue'
import { DownOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { registerMobileChildOverlay } from '@/composables/mobileChildOverlay'
import { useMobileViewport } from '@/composables/useMatchMedia'
import {
  defaultFilterSelectOption,
  filterSelectOptionGroups,
  findSelectOptionLabel,
  type SelectOptionsInput,
} from '@/core/util/select-options'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    value?: string | number | null
    options?: SelectOptionsInput
    placeholder?: string
    disabled?: boolean
    allowClear?: boolean
    showSearch?: boolean
    filterOption?: (input: string, option: unknown) => boolean
    /** Mobil sheet başlığı; yoksa placeholder kullanılır. */
    mobileTitle?: string
    size?: 'small' | 'middle' | 'large'
  }>(),
  {
    placeholder: 'Seçim yapın',
    disabled: false,
    allowClear: false,
    showSearch: false,
    size: 'middle',
  },
)

const emit = defineEmits<{
  'update:value': [value: string | number | undefined]
  change: [value: string | number | undefined]
}>()

const attrs = useAttrs()
const slots = useSlots()
const isMobileViewport = useMobileViewport()
const sheetOpen = ref(false)
const searchQuery = ref('')
let bodyOverflowBeforeSheet: string | null = null
let releaseChildOverlay: (() => void) | undefined

const filterFn = computed(() => props.filterOption ?? defaultFilterSelectOption)

const displayLabel = computed(() => findSelectOptionLabel(props.options, props.value))

const sheetTitle = computed(() => props.mobileTitle ?? props.placeholder ?? 'Seçin')

const filteredGroups = computed(() =>
  filterSelectOptionGroups(props.options ?? [], searchQuery.value, filterFn.value),
)

const sheetEmpty = computed(
  () => filteredGroups.value.every((group) => group.options.length === 0),
)

const desktopBind = computed(() => ({
  ...attrs,
  value: props.value ?? undefined,
  options: props.options ? [...props.options] : undefined,
  placeholder: props.placeholder,
  disabled: props.disabled,
  allowClear: props.allowClear,
  showSearch: props.showSearch,
  filterOption: filterFn.value,
  size: props.size,
}))

function emitValue(raw: unknown): void {
  const next = raw == null || raw === '' ? undefined : (raw as string | number)
  emit('update:value', next)
  emit('change', next)
}

function openSheet(): void {
  if (props.disabled) return
  sheetOpen.value = true
  searchQuery.value = ''
}

function closeSheet(): void {
  sheetOpen.value = false
  searchQuery.value = ''
}

function lockBodyScroll(): void {
  if (typeof document === 'undefined') return
  bodyOverflowBeforeSheet = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return
  if (bodyOverflowBeforeSheet != null) {
    document.body.style.overflow = bodyOverflowBeforeSheet
  } else {
    document.body.style.removeProperty('overflow')
  }
  bodyOverflowBeforeSheet = null
}

function lockChildOverlay(): void {
  releaseChildOverlay?.()
  releaseChildOverlay = registerMobileChildOverlay()
}

function unlockChildOverlay(): void {
  releaseChildOverlay?.()
  releaseChildOverlay = undefined
}

watch(sheetOpen, (open) => {
  if (open) {
    lockBodyScroll()
    lockChildOverlay()
  } else {
    unlockChildOverlay()
  }
})

function onSheetAfterLeave(): void {
  unlockBodyScroll()
}

onBeforeUnmount(() => {
  unlockChildOverlay()
  if (sheetOpen.value) {
    unlockBodyScroll()
  }
})

function pickOption(value: string | number, disabled?: boolean): void {
  if (disabled) return
  emitValue(value)
  closeSheet()
}

function clearValue(event: Event): void {
  event.stopPropagation()
  emitValue(undefined)
}

defineExpose({ closeSheet })
</script>

<template>
  <Select
    v-if="!isMobileViewport"
    v-bind="desktopBind"
    @update:value="emitValue"
  >
    <template v-if="slots.footer" #dropdownRender="{ menuNode }">
      <component :is="menuNode" />
      <Divider style="margin: 4px 0" />
      <div class="kp-select-footer" @mousedown.prevent>
        <slot name="footer" />
      </div>
    </template>
  </Select>

  <template v-else>
    <div class="kp-select-mobile-root" v-bind="attrs">
    <button
      type="button"
      class="kp-select-trigger"
      :class="{
        'kp-select-trigger--disabled': disabled,
        'kp-select-trigger--sm': size === 'small',
        'kp-select-trigger--placeholder': !displayLabel,
      }"
      :disabled="disabled"
      :aria-label="displayLabel || placeholder"
      @click="openSheet"
    >
      <span class="kp-select-trigger__value">
        {{ displayLabel || placeholder }}
      </span>
      <span class="kp-select-trigger__icons">
        <span
          v-if="allowClear && value != null && value !== '' && !disabled"
          class="kp-select-trigger__clear"
          role="button"
          tabindex="-1"
          aria-label="Temizle"
          @click="clearValue"
        >
          ×
        </span>
        <DownOutlined class="kp-select-trigger__arrow" />
      </span>
    </button>

    <Teleport to="body">
      <Transition name="kp-select-sheet" @after-leave="onSheetAfterLeave">
        <div v-if="sheetOpen" class="kp-select-sheet-root">
          <button
            type="button"
            class="kp-select-sheet-mask"
            aria-label="Kapat"
            @click="closeSheet"
          />
          <div
            class="kp-select-sheet-panel"
            role="dialog"
            aria-modal="true"
            :aria-label="sheetTitle"
          >
            <div class="kp-select-sheet__inner">
              <header class="kp-select-sheet__head">
                <span class="kp-select-sheet__title">{{ sheetTitle }}</span>
                <button type="button" class="kp-select-sheet__close" aria-label="Kapat" @click="closeSheet">
                  <CloseOutlined />
                </button>
              </header>

              <Input
                v-if="showSearch"
                v-model:value="searchQuery"
                allow-clear
                placeholder="Ara…"
                class="kp-select-sheet__search"
              />

              <div class="kp-select-sheet__list">
                <template v-if="!sheetEmpty">
                  <section
                    v-for="(group, groupIndex) in filteredGroups"
                    :key="group.label || `group-${groupIndex}`"
                    class="kp-select-sheet__group"
                  >
                    <div v-if="group.label" class="kp-select-sheet__group-label">
                      {{ group.label }}
                    </div>
                    <button
                      v-for="opt in group.options"
                      :key="String(opt.value)"
                      type="button"
                      class="kp-select-sheet__option"
                      :class="{
                        'kp-select-sheet__option--active': opt.value === value,
                        'kp-select-sheet__option--disabled': opt.disabled,
                      }"
                      :disabled="opt.disabled"
                      @click="pickOption(opt.value, opt.disabled)"
                    >
                      <span class="kp-select-sheet__option-label">{{ opt.label }}</span>
                      <CheckOutlined v-if="opt.value === value" class="kp-select-sheet__option-check" />
                    </button>
                  </section>
                </template>
                <Empty v-else description="Sonuç yok" class="kp-select-sheet__empty" />
              </div>

              <footer v-if="slots.footer" class="kp-select-sheet__foot">
                <slot name="footer" />
              </footer>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    </div>
  </template>
</template>

<style scoped>
.kp-select-mobile-root {
  display: block;
  width: 100%;
  max-width: 100%;
}

.kp-select-trigger {
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

.kp-select-trigger--sm {
  min-height: 24px;
  padding: 0 7px;
  font-size: 14px;
}

.kp-select-trigger--placeholder .kp-select-trigger__value {
  color: var(--ant-color-text-placeholder, rgba(0, 0, 0, 0.25));
}

.kp-select-trigger--disabled {
  color: var(--ant-color-text-disabled, rgba(0, 0, 0, 0.25));
  background: var(--ant-color-bg-container-disabled, rgba(0, 0, 0, 0.04));
  cursor: not-allowed;
}

.kp-select-trigger__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-select-trigger__icons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex-shrink: 0;
  color: var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25));
}

.kp-select-trigger__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 14px;
  line-height: 1;
}

.kp-select-trigger__arrow {
  font-size: 12px;
}

.kp-select-footer {
  padding: 4px 8px;
}

.kp-select-sheet__inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.kp-select-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.kp-select-sheet__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
}

.kp-select-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--ant-border-radius, 6px);
  background: transparent;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
  cursor: pointer;
}

.kp-select-sheet__close:hover,
.kp-select-sheet__close:focus-visible {
  background: var(--ant-color-fill-secondary, rgba(0, 0, 0, 0.06));
}

.kp-select-sheet__search {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.kp-select-sheet__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.kp-select-sheet__group + .kp-select-sheet__group {
  margin-top: 8px;
}

.kp-select-sheet__group-label {
  padding: 8px 4px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
}

.kp-select-sheet__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 8px;
  border: 0;
  border-radius: var(--ant-border-radius, 6px);
  background: transparent;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  font-size: 15px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.kp-select-sheet__option:active:not(:disabled) {
  background: var(--ant-color-fill-secondary, rgba(0, 0, 0, 0.06));
}

.kp-select-sheet__option--active {
  color: var(--ant-color-primary, #1677ff);
  font-weight: 500;
}

.kp-select-sheet__option--disabled {
  color: var(--ant-color-text-disabled, rgba(0, 0, 0, 0.25));
  cursor: not-allowed;
}

.kp-select-sheet__option-label {
  flex: 1;
  min-width: 0;
}

.kp-select-sheet__option-check {
  flex-shrink: 0;
  color: var(--ant-color-primary, #1677ff);
}

.kp-select-sheet__empty {
  margin: 24px 0;
}

.kp-select-sheet__foot {
  flex-shrink: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
}

</style>

<style>
/* Teleport — AntDV Drawer değil; form drawer push/stack davranışına karışmaz. */
.kp-select-sheet-root {
  position: fixed;
  inset: 0;
  z-index: 1500;
}

.kp-select-sheet-mask {
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.kp-select-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: min(75dvh, 520px);
  display: flex;
  flex-direction: column;
  background: var(--ant-color-bg-elevated, #fff);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.08);
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  overflow: hidden;
  will-change: transform;
}

.kp-select-sheet-enter-active .kp-select-sheet-mask,
.kp-select-sheet-leave-active .kp-select-sheet-mask {
  transition: opacity 0.22s ease;
}

.kp-select-sheet-enter-active .kp-select-sheet-panel,
.kp-select-sheet-leave-active .kp-select-sheet-panel {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.kp-select-sheet-enter-from .kp-select-sheet-mask,
.kp-select-sheet-leave-to .kp-select-sheet-mask {
  opacity: 0;
}

.kp-select-sheet-enter-from .kp-select-sheet-panel,
.kp-select-sheet-leave-to .kp-select-sheet-panel {
  transform: translate3d(0, 100%, 0);
}

@media (prefers-reduced-motion: reduce) {
  .kp-select-sheet-enter-active .kp-select-sheet-mask,
  .kp-select-sheet-leave-active .kp-select-sheet-mask,
  .kp-select-sheet-enter-active .kp-select-sheet-panel,
  .kp-select-sheet-leave-active .kp-select-sheet-panel {
    transition-duration: 0.01ms !important;
  }
}

[data-theme='dark'] .kp-select-sheet-panel {
  box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.45);
}
</style>
