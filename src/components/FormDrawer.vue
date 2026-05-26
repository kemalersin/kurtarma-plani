<script setup lang="ts">
import { Drawer } from 'ant-design-vue'
import { computed, nextTick, useSlots, useTemplateRef, watch } from 'vue'
import { mobileChildOverlayDepth } from '@/composables/mobileChildOverlay'
import { KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'
import { useDrawerStack } from '@/composables/useDrawerStack'
import { focusFirstFormField } from '@/composables/useDrawerFormFocus'

interface Props {
  stackId: string
  open: boolean
  title: string
  width?: string | number
  maskClosable?: boolean
  /** Üst özet + tablo: drawer tam yükseklik, tablo kalan alanı doldurur. */
  layout?: 'default' | 'table'
  /** Mobilde #actions footer'da; masaüstünde header. Taksit planı erken kapama için. */
  mobileActionsInFooter?: boolean
  /** Ek kök sınıfları (`kp-form-drawer--list-filter` vb.). */
  drawerClass?: string
  /** Açılışta ilk form alanına otomatik odaklanma (varsayılan: açık). */
  autoFocusFirst?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 'min(560px, 100vw)',
  maskClosable: true,
  layout: 'default',
  mobileActionsInFooter: false,
  autoFocusFirst: true,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const isMobileViewport = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const slots = useSlots()
const { push, pop, zIndex, stackOffset, contentWrapperStyle } = useDrawerStack(props.stackId)
const formRoot = useTemplateRef<HTMLElement>('formRoot')

const drawerWidth = computed(() => (isMobileViewport.value ? '100%' : props.width))

/** Üstte başka drawer veya child overlay varken alttaki drawer kaydırma çubuğu gizlenir. */
const hideBodyScrollbar = computed(
  () =>
    isMobileViewport.value &&
    props.open &&
    (stackOffset.value !== 0 || mobileChildOverlayDepth.value > 0),
)

const showActionsInHeader = computed(
  () => !!slots.actions && !(props.mobileActionsInFooter && isMobileViewport.value),
)

const showActionsInFooter = computed(
  () => !!slots.actions && props.mobileActionsInFooter && isMobileViewport.value,
)

const drawerRootClass = computed(() =>
  [
    'kp-form-drawer',
    props.drawerClass,
    props.layout === 'table' ? 'kp-form-drawer--table-layout' : '',
    showActionsInFooter.value ? 'kp-form-drawer--mobile-footer' : '',
    hideBodyScrollbar.value ? 'kp-form-drawer--hide-body-scrollbar' : '',
  ]
    .filter(Boolean)
    .join(' '),
)

const showHeaderExtra = computed(() => !!slots.extra || showActionsInHeader.value)

watch(
  () => props.open,
  (open) => {
    if (open) push()
    else pop()
  },
  { immediate: true },
)

function onAfterOpenChange(open: boolean): void {
  if (open && props.autoFocusFirst) {
    void nextTick(() => focusFirstFormField(formRoot.value))
  }
}

function close(): void {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <Drawer
    :open="open"
    :title="title"
    :width="drawerWidth"
    :z-index="zIndex"
    :content-wrapper-style="contentWrapperStyle"
    :mask-closable="maskClosable"
    :root-class-name="drawerRootClass"
    @close="close"
    @after-open-change="onAfterOpenChange"
  >
    <div ref="formRoot" class="kp-form-drawer__body">
      <slot />
    </div>
    <template v-if="showHeaderExtra" #extra>
      <div class="kp-form-drawer__header-actions">
        <slot name="extra" />
        <slot v-if="showActionsInHeader" name="actions" />
      </div>
    </template>
    <template v-if="showActionsInFooter" #footer>
      <div class="kp-form-drawer__footer-actions">
        <slot name="actions" />
      </div>
    </template>
  </Drawer>
</template>
