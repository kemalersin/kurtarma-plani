<script setup lang="ts">
import { Tooltip } from 'ant-design-vue'
import { computed, useAttrs } from 'vue'
import { KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  title?: string
}>()

const isMobileViewport = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const attrs = useAttrs()

const showTooltip = computed(() => !isMobileViewport.value && !!props.title)
</script>

<template>
  <Tooltip v-if="showTooltip" v-bind="attrs" :title="title">
    <slot />
  </Tooltip>
  <span v-else-if="title" class="kp-tooltip-fallback" :aria-label="title">
    <slot />
  </span>
  <slot v-else />
</template>

<style scoped>
.kp-tooltip-fallback {
  display: inline-flex;
  vertical-align: middle;
}
</style>
