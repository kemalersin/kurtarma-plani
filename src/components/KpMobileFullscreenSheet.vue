<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue'
import { Button } from 'ant-design-vue'

defineProps<{
  open: boolean
  title: string
  showConfirm?: boolean
  confirmDisabled?: boolean
  confirmText?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
  'after-leave': []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="kp-mobile-picker-sheet" @after-leave="emit('after-leave')">
      <div v-if="open" class="kp-mobile-picker-sheet-root">
        <button
          type="button"
          class="kp-mobile-picker-sheet-mask"
          aria-label="Kapat"
          @click="emit('close')"
        />
        <div
          class="kp-mobile-picker-sheet-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="kp-mobile-picker-sheet__head">
            <span class="kp-mobile-picker-sheet__title">{{ title }}</span>
            <button
              type="button"
              class="kp-mobile-picker-sheet__close"
              aria-label="Kapat"
              @click="emit('close')"
            >
              <CloseOutlined />
            </button>
          </header>

          <div class="kp-mobile-picker-sheet__body">
            <slot />
          </div>

          <footer v-if="showConfirm" class="kp-mobile-picker-sheet__foot">
            <Button type="primary" block :disabled="confirmDisabled" @click="emit('confirm')">
              {{ confirmText ?? 'Tamam' }}
            </Button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.kp-mobile-picker-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.kp-mobile-picker-sheet__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
}

.kp-mobile-picker-sheet__close {
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

.kp-mobile-picker-sheet__body {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.kp-mobile-picker-sheet__foot {
  flex-shrink: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
}

[data-theme='dark'] .kp-mobile-picker-sheet__foot {
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>

<style>
.kp-mobile-picker-sheet-root {
  position: fixed;
  inset: 0;
  z-index: 1500;
}

.kp-mobile-picker-sheet-mask {
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.kp-mobile-picker-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-height: min(85dvh, 560px);
  display: flex;
  flex-direction: column;
  background: var(--ant-color-bg-elevated, #fff);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.08);
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  will-change: transform;
}

.kp-mobile-picker-sheet-enter-active .kp-mobile-picker-sheet-mask,
.kp-mobile-picker-sheet-leave-active .kp-mobile-picker-sheet-mask {
  transition: opacity 0.22s ease;
}

.kp-mobile-picker-sheet-enter-active .kp-mobile-picker-sheet-panel,
.kp-mobile-picker-sheet-leave-active .kp-mobile-picker-sheet-panel {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.kp-mobile-picker-sheet-enter-from .kp-mobile-picker-sheet-mask,
.kp-mobile-picker-sheet-leave-to .kp-mobile-picker-sheet-mask {
  opacity: 0;
}

.kp-mobile-picker-sheet-enter-from .kp-mobile-picker-sheet-panel,
.kp-mobile-picker-sheet-leave-to .kp-mobile-picker-sheet-panel {
  transform: translate3d(0, 100%, 0);
}

@media (prefers-reduced-motion: reduce) {
  .kp-mobile-picker-sheet-enter-active .kp-mobile-picker-sheet-mask,
  .kp-mobile-picker-sheet-leave-active .kp-mobile-picker-sheet-mask,
  .kp-mobile-picker-sheet-enter-active .kp-mobile-picker-sheet-panel,
  .kp-mobile-picker-sheet-leave-active .kp-mobile-picker-sheet-panel {
    transition-duration: 0.01ms !important;
  }
}

[data-theme='dark'] .kp-mobile-picker-sheet-panel {
  background: var(--ant-color-bg-elevated, #1f1f1f);
  box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.45);
}
</style>
