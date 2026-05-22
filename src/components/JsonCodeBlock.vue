<script setup lang="ts">
import { computed } from 'vue'
import { highlightJson } from '@/core/util/json-highlight'

const props = withDefaults(
  defineProps<{
    code: string
    /** Örn. `360px`, `min(50vh, 400px)` */
    maxHeight?: string
  }>(),
  {
    maxHeight: '360px',
  },
)

const highlighted = computed(() => highlightJson(props.code))
</script>

<template>
  <pre
    class="kp-json-block"
    :style="maxHeight ? { maxHeight } : undefined"
  ><code v-html="highlighted" /></pre>
</template>

<style scoped>
.kp-json-block {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 12px 14px;
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

[data-theme='dark'] .kp-json-block {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.kp-json-block :deep(code) {
  font-family: inherit;
  font-size: inherit;
  background: transparent;
  padding: 0;
}
</style>
