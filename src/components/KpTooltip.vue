<script setup lang="ts">
import { Tooltip } from 'ant-design-vue'
import { computed, useAttrs } from 'vue'
import { useHoverCapable, useMobileViewport } from '@/composables/useMatchMedia'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  title?: string
}>()

const isMobileViewport = useMobileViewport()
const isHoverCapable = useHoverCapable()
const attrs = useAttrs()

const showTooltip = computed(
  () => !isMobileViewport.value && isHoverCapable.value && !!props.title,
)
</script>

<template>
  <Tooltip
    v-if="showTooltip"
    :title="title"
    :trigger="['hover']"
    :destroy-tooltip-on-hide="true"
    v-bind="attrs"
  >
    <slot />
  </Tooltip>
  <span v-else-if="title" class="kp-tooltip-fallback">
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
