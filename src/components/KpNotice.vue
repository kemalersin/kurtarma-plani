<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Button } from 'ant-design-vue'
import {
  CloseOutlined,
  CloseCircleFilled,
  InfoCircleFilled,
  WarningFilled,
} from '@ant-design/icons-vue'

export type KpNoticeTone = 'info' | 'warning' | 'error' | 'legal'

const props = withDefaults(
  defineProps<{
    tone?: KpNoticeTone
    /** Ana mesaj */
    title: string
    /** İkincil açıklama (opsiyonel) */
    detail?: string
    closable?: boolean
  }>(),
  {
    tone: 'info',
    closable: false,
  },
)

const emit = defineEmits<{
  close: []
}>()

const icon = computed<Component>(() => {
  if (props.tone === 'error') return CloseCircleFilled
  if (props.tone === 'warning' || props.tone === 'legal') return WarningFilled
  return InfoCircleFilled
})
</script>

<template>
  <div class="kp-notice" :data-tone="tone" role="status">
    <component :is="icon" class="kp-notice__icon" aria-hidden="true" />
    <div class="kp-notice__content">
      <p class="kp-notice__title">{{ title }}</p>
      <p v-if="detail" class="kp-notice__detail">{{ detail }}</p>
      <div v-if="$slots.action" class="kp-notice__inline-action">
        <slot name="action" />
      </div>
    </div>
    <div v-if="closable" class="kp-notice__close-wrap">
      <Button
        type="text"
        size="small"
        class="kp-notice__close"
        aria-label="Kapat"
        @click="emit('close')"
      >
        <CloseOutlined />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.kp-notice {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--kp-radius, 8px);
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02));
}

.kp-notice__icon {
  font-size: 16px;
  line-height: 1.45;
  margin-top: 1px;
}

.kp-notice__content {
  min-width: 0;
}

.kp-notice__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  font-weight: 500;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
}

.kp-notice__detail {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
}

.kp-notice__inline-action {
  margin-top: 8px;
}

.kp-notice__close-wrap {
  align-self: start;
}

.kp-notice__close {
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
}

.kp-notice__close:hover {
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
}

/* tone */
.kp-notice[data-tone='info'] {
  border-color: var(--ant-color-info-border, #91caff);
  background: var(--ant-color-info-bg, #e6f4ff);
}
.kp-notice[data-tone='info'] .kp-notice__icon {
  color: var(--ant-color-info, #1677ff);
}

.kp-notice[data-tone='warning'],
.kp-notice[data-tone='legal'] {
  border-color: var(--ant-color-warning-border, #ffe58f);
  background: var(--ant-color-warning-bg, #fffbe6);
}
.kp-notice[data-tone='warning'] .kp-notice__icon,
.kp-notice[data-tone='legal'] .kp-notice__icon {
  color: var(--ant-color-warning, #faad14);
}

.kp-notice[data-tone='error'] {
  border-color: var(--ant-color-error-border, #ffccc7);
  background: var(--ant-color-error-bg, #fff2f0);
}
.kp-notice[data-tone='error'] .kp-notice__icon {
  color: var(--ant-color-error, #ff4d4f);
}

@media (max-width: 640px) {
  .kp-notice {
    grid-template-columns: auto 1fr auto;
    padding: 10px 12px;
    gap: 10px;
  }

  .kp-notice__title {
    font-size: 13px;
  }

  .kp-notice__detail {
    font-size: 12px;
  }
}

[data-theme='dark'] .kp-notice {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

[data-theme='dark'] .kp-notice__title {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-notice__detail {
  color: rgba(255, 255, 255, 0.55);
}

[data-theme='dark'] .kp-notice__close {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-notice__close:hover {
  color: rgba(255, 255, 255, 0.65);
}

[data-theme='dark'] .kp-notice[data-tone='info'] {
  border-color: rgba(22, 119, 255, 0.35);
  background: rgba(22, 119, 255, 0.12);
}

[data-theme='dark'] .kp-notice[data-tone='info'] .kp-notice__icon {
  color: #4096ff;
}

[data-theme='dark'] .kp-notice[data-tone='warning'],
[data-theme='dark'] .kp-notice[data-tone='legal'] {
  border-color: rgba(250, 173, 20, 0.35);
  background: rgba(250, 173, 20, 0.1);
}

[data-theme='dark'] .kp-notice[data-tone='warning'] .kp-notice__icon,
[data-theme='dark'] .kp-notice[data-tone='legal'] .kp-notice__icon {
  color: #ffc53d;
}

[data-theme='dark'] .kp-notice[data-tone='error'] {
  border-color: rgba(255, 77, 79, 0.35);
  background: rgba(255, 77, 79, 0.1);
}

[data-theme='dark'] .kp-notice[data-tone='error'] .kp-notice__icon {
  color: #ff7875;
}
</style>
