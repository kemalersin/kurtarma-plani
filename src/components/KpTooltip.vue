<script setup lang="ts">
import { Popover, Tooltip } from 'ant-design-vue'
import { computed, useAttrs } from 'vue'
import { useHoverCapable, useMobileViewport } from '@/composables/useMatchMedia'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    title?: string
    /**
     * Bilgi ikonu modu: masaüstünde hover + tıklama; dokunmatik / mobilde tıklamalı popover.
     * Aksiyon düğmelerinde (Düzenle/Sil) kullanmayın — varsayılan yalnızca hover.
     */
    hint?: boolean
    /** Etiket metni + ikon birlikte tetikleyici; popover etiket ortasına hizalanır. */
    wide?: boolean
  }>(),
  {
    hint: false,
    wide: false,
  },
)

const isMobileViewport = useMobileViewport()
const isHoverCapable = useHoverCapable()
const attrs = useAttrs()

/** Liste/ kabuk aksiyonları: yalnızca hover (ince işaretçi). */
const showDefaultTooltip = computed(
  () =>
    !!props.title &&
    !props.hint &&
    !isMobileViewport.value &&
    isHoverCapable.value,
)

/** Bilgi ikonu + hover destekli masaüstü: tooltip (hover, odak, tıklama). */
const showHintTooltip = computed(
  () =>
    !!props.title &&
    props.hint &&
    !isMobileViewport.value &&
    isHoverCapable.value,
)

/** Bilgi ikonu, hover yok veya mobil: tıklamalı popover. */
const showHintPopover = computed(
  () => !!props.title && props.hint && !showHintTooltip.value,
)

const tooltipTriggers = computed((): ('hover' | 'focus' | 'click')[] =>
  props.hint ? ['hover', 'focus', 'click'] : ['hover'],
)

/** Viewport taşmasını önle; sayısal adjustX CSS margin ile çakışıp genişliği sonradan daraltır. */
const hintPopoverAlign = {
  overflow: {
    adjustX: true,
    adjustY: true,
  },
} as const

const hintPopoverInnerStyle = {
  maxWidth: 'min(320px, calc(100vw - 24px))',
  boxSizing: 'border-box' as const,
}
</script>

<template>
  <Tooltip
    v-if="showDefaultTooltip || showHintTooltip"
    :title="title"
    :trigger="tooltipTriggers"
    :placement="hint ? 'top' : undefined"
    :destroy-tooltip-on-hide="true"
    v-bind="attrs"
  >
    <span
      v-if="hint"
      :class="['kp-info-hint-trigger', wide && 'kp-info-hint-trigger--wide']"
      tabindex="0"
      role="button"
      :aria-label="title"
    >
      <slot />
    </span>
    <slot v-else />
  </Tooltip>
  <Popover
    v-else-if="showHintPopover"
    :content="title"
    trigger="click"
    placement="top"
    :arrow="{ pointAtCenter: true }"
    :align="hintPopoverAlign"
    :overlay-inner-style="hintPopoverInnerStyle"
    overlay-class-name="kp-info-hint-popover"
    v-bind="attrs"
  >
    <span
      :class="['kp-info-hint-trigger', wide && 'kp-info-hint-trigger--wide']"
      tabindex="0"
      role="button"
      :aria-label="title"
    >
      <slot />
    </span>
  </Popover>
  <span
    v-else-if="title && hint"
    :class="['kp-info-hint-trigger', wide && 'kp-info-hint-trigger--wide']"
    :aria-label="title"
  >
    <slot />
  </span>
  <slot v-else />
</template>
