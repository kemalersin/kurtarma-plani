<script setup lang="ts">
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import KpTooltip from '@/components/KpTooltip.vue'

/** AntDV FormItem `#label` içinde metin + opsiyonel bilgi ikonu. */
defineProps<{
  hint?: string
}>()
</script>

<template>
  <KpTooltip v-if="hint" hint wide :title="hint">
    <span class="kp-form-label kp-form-label--hint-trigger">
      <span class="kp-form-label__text"><slot /></span>
      <InfoCircleOutlined class="kp-info-hint__icon" aria-hidden="true" />
    </span>
  </KpTooltip>
  <span v-else class="kp-form-label">
    <span class="kp-form-label__text"><slot /></span>
  </span>
</template>
