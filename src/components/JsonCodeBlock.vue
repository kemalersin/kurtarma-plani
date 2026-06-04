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
