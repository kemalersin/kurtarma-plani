<script setup lang="ts">
import { computed } from 'vue'
import { normalizeHexColor } from '@/core/util/color'

interface Props {
  color?: string | null
  /** Boş renk için açıklama (erişilebilirlik) */
  emptyLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  emptyLabel: 'Renk yok',
})

const resolved = computed(() => normalizeHexColor(props.color))
</script>

<template>
  <span
    class="kp-color-swatch"
    :class="{ 'kp-color-swatch--empty': !resolved }"
    :style="resolved ? { backgroundColor: resolved } : undefined"
    role="img"
    :aria-label="resolved ?? emptyLabel"
  />
</template>

<style scoped>
.kp-color-swatch {
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  min-width: 20px;
  min-height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  vertical-align: middle;
  box-sizing: border-box;
}

.kp-color-swatch--empty {
  background: repeating-linear-gradient(
    45deg,
    rgba(0, 0, 0, 0.06),
    rgba(0, 0, 0, 0.06) 4px,
    rgba(0, 0, 0, 0.12) 4px,
    rgba(0, 0, 0, 0.12) 8px
  );
}

[data-theme='dark'] .kp-color-swatch {
  border-color: rgba(255, 255, 255, 0.2);
}

[data-theme='dark'] .kp-color-swatch--empty {
  background: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.06),
    rgba(255, 255, 255, 0.06) 4px,
    rgba(255, 255, 255, 0.14) 4px,
    rgba(255, 255, 255, 0.14) 8px
  );
}
</style>
