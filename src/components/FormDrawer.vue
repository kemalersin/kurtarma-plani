<script setup lang="ts">
import { Drawer } from 'ant-design-vue'
import { computed, nextTick, useSlots, useTemplateRef, watch } from 'vue'
import { KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'
import { useDrawerStack } from '@/composables/useDrawerStack'
import { focusFirstFormField, resetFormDrawerScroll } from '@/composables/useDrawerFormFocus'

interface Props {
  stackId: string
  open: boolean
  title: string
  width?: string | number
  maskClosable?: boolean
  /** Üst özet + tablo: drawer tam yükseklik, tablo kalan alanı doldurur. */
  layout?: 'default' | 'table'
  /** #actions her zaman drawer footer'da (masaüstü + mobil). */
  actionsInFooter?: boolean
  /** Mobilde #actions footer'da; masaüstünde header. Taksit planı vb. */
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
  actionsInFooter: false,
  mobileActionsInFooter: false,
  autoFocusFirst: true,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const isMobileViewport = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const slots = useSlots()
const { push, pop, zIndex, contentWrapperStyle } = useDrawerStack(props.stackId)
const formRoot = useTemplateRef<HTMLElement>('formRoot')

const drawerWidth = computed(() => (isMobileViewport.value ? '100%' : props.width))

const showActionsInFooter = computed(
  () =>
    !!slots.actions &&
    (props.actionsInFooter || (props.mobileActionsInFooter && isMobileViewport.value)),
)

const showActionsInHeader = computed(
  () => !!slots.actions && !showActionsInFooter.value,
)

const drawerRootClass = computed(() =>
  [
    'kp-form-drawer',
    props.drawerClass,
    props.layout === 'table' ? 'kp-form-drawer--table-layout' : '',
    showActionsInFooter.value ? 'kp-form-drawer--mobile-footer' : '',
  ]
    .filter(Boolean)
    .join(' '),
)

const showHeaderExtra = computed(() => !!slots.extra || showActionsInHeader.value)

watch(
  () => props.open,
  (open) => {
    if (open) {
      push()
      resetFormDrawerScroll(formRoot.value)
      void nextTick(() => resetFormDrawerScroll(formRoot.value))
    } else {
      pop()
      // Kapanırken sıfırla; bir sonraki açılışta animasyon sırasında zıplama olmaz
      resetFormDrawerScroll(formRoot.value)
      void nextTick(() => resetFormDrawerScroll(formRoot.value))
    }
  },
  { immediate: true },
)

function onAfterOpenChange(open: boolean): void {
  if (!open || !props.autoFocusFirst) return
  void nextTick(() => focusFirstFormField(formRoot.value))
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
