<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from 'ant-design-vue'
import { RobotOutlined } from '@ant-design/icons-vue'
import KpAiChatPanel from '@/components/KpAiChatPanel.vue'
import { KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'
import { useAnyModalOpen } from '@/composables/useAnyModalOpen'
import { useAnyDrawerOpen } from '@/composables/useDrawerStack'
import {
  resolveAiChatKey,
  resolveAiChatPlaceholder,
  shouldShowAiChatFab,
} from '@/features/ai/page-chat'
import { useAiStore } from '@/stores/ai'

const route = useRoute()
const ai = useAiStore()
const isMobile = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const anyDrawerOpen = useAnyDrawerOpen()
const anyModalOpen = useAnyModalOpen()

const open = ref(false)
const expanded = ref(false)

const showFab = computed(
  () => shouldShowAiChatFab(route) && ai.showFloatingChatFab,
)
const showFabButton = computed(() => {
  if (anyDrawerOpen.value || anyModalOpen.value) return false
  if (!open.value) return true
  if (isMobile.value) return false
  return !expanded.value
})
const chatKey = computed(() => resolveAiChatKey(route))
const placeholder = computed(() => resolveAiChatPlaceholder(route))
const desktopExpandable = computed(() => !isMobile.value)

async function syncSession(): Promise<void> {
  if (!showFab.value) return
  await ai.switchSession(chatKey.value)
}

function toggleOpen(): void {
  open.value = !open.value
}

function closePanel(): void {
  open.value = false
  expanded.value = false
}

function onEscapeKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  if (expanded.value) {
    expanded.value = false
    return
  }
  closePanel()
}

watch(chatKey, () => {
  void syncSession()
})

watch(open, (isOpen) => {
  if (!isOpen) expanded.value = false
})

watch(
  [open, expanded, isMobile],
  ([isOpen, isExpanded, mobile]) => {
    document.body.style.overflow =
      isOpen && (mobile || isExpanded) ? 'hidden' : ''
  },
  { immediate: true },
)

watch(
  () => ai.showFloatingChatFab,
  (visible) => {
    if (!visible) closePanel()
  },
)

onMounted(async () => {
  if (!ai.loaded) await ai.load()
  await syncSession()
  window.addEventListener('keydown', onEscapeKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscapeKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport v-if="showFab" to="body">
    <Button
      type="primary"
      shape="circle"
      size="large"
      class="kp-ai-fab"
      :class="{
        'kp-ai-fab--visible': showFabButton,
        'kp-ai-fab--open': open && showFabButton,
      }"
      aria-label="AI sohbet"
      :aria-hidden="!showFabButton"
      @click="toggleOpen"
    >
      <RobotOutlined />
    </Button>

    <Transition name="kp-ai-widget">
      <div
        v-if="open"
        class="kp-ai-widget"
        :class="{
          'kp-ai-widget--mobile': isMobile,
          'kp-ai-widget--expanded': expanded && !isMobile,
        }"
        role="dialog"
        aria-modal="true"
        aria-label="AI sohbet"
      >
        <button
          v-if="!expanded || isMobile"
          type="button"
          class="kp-ai-widget__backdrop"
          aria-label="Sohbeti kapat"
          @click="closePanel"
        />
        <div class="kp-ai-widget__panel">
          <KpAiChatPanel
            v-model:expanded="expanded"
            variant="floating"
            :empty-hint="placeholder"
            toolbar-title="AI Asistan"
            :expandable="desktopExpandable"
            show-close
            @close="closePanel"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.kp-ai-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1050;
  width: 56px;
  height: 56px;
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.35);
  font-size: 22px;
  opacity: 0;
  transform: scale(0.88);
  pointer-events: none;
  transition:
    opacity 0.28s ease,
    transform 0.28s ease,
    box-shadow 0.2s ease;
}

.kp-ai-fab--visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.kp-ai-fab--visible:hover {
  transform: scale(1.04);
}

.kp-ai-fab--visible.kp-ai-fab--open {
  transform: scale(0.96);
  box-shadow: 0 2px 10px rgba(22, 119, 255, 0.25);
}

.kp-ai-widget {
  position: fixed;
  inset: 0;
  z-index: 1040;
  pointer-events: none;
}

.kp-ai-widget__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: rgba(0, 0, 0, 0.12);
  cursor: pointer;
  pointer-events: auto;
}

[data-theme='dark'] .kp-ai-widget__backdrop {
  background: rgba(0, 0, 0, 0.45);
}

.kp-ai-widget__panel {
  position: absolute;
  right: 16px;
  bottom: 88px;
  width: min(var(--kp-ai-floating-panel-width, 480px), calc(100vw - 32px));
  height: min(var(--kp-ai-floating-panel-height, 640px), calc(100dvh - 120px));
  display: flex;
  flex-direction: column;
  border-radius: var(--kp-radius, 12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
  overflow: hidden;
  pointer-events: auto;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

[data-theme='dark'] .kp-ai-widget__panel {
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

.kp-ai-widget--mobile .kp-ai-widget__panel {
  inset: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
}

.kp-ai-widget--mobile .kp-ai-widget__backdrop {
  display: none;
}

.kp-ai-widget--expanded {
  z-index: 1060;
  pointer-events: auto;
}

.kp-ai-widget--expanded .kp-ai-widget__panel {
  inset: 12px;
  right: 12px;
  bottom: 12px;
  left: 12px;
  width: auto;
  height: auto;
  border-radius: var(--kp-radius, 12px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

[data-theme='dark'] .kp-ai-widget--expanded .kp-ai-widget__panel {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.kp-ai-widget-enter-active,
.kp-ai-widget-leave-active {
  transition: opacity 0.2s ease;
}

.kp-ai-widget-enter-active .kp-ai-widget__panel,
.kp-ai-widget-leave-active .kp-ai-widget__panel {
  transition: transform 0.24s ease, opacity 0.2s ease;
}

.kp-ai-widget-enter-from,
.kp-ai-widget-leave-to {
  opacity: 0;
}

.kp-ai-widget-enter-from .kp-ai-widget__panel,
.kp-ai-widget-leave-to .kp-ai-widget__panel {
  transform: translateY(16px) scale(0.98);
  opacity: 0;
}

@media (max-width: 640px) {
  .kp-ai-fab {
    right: 16px;
    bottom: 16px;
  }
}
</style>
