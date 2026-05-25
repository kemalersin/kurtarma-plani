<script setup lang="ts">
import { Drawer } from 'ant-design-vue'
import { computed, nextTick, useSlots, useTemplateRef, watch } from 'vue'
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
}

const props = withDefaults(defineProps<Props>(), {
  width: 'min(560px, 100vw)',
  maskClosable: true,
  layout: 'default',
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

const drawerRootClass = computed(() =>
  [
    'kp-form-drawer',
    props.layout === 'table' ? 'kp-form-drawer--table-layout' : '',
    isMobileViewport.value && !!slots.actions
      ? 'kp-form-drawer--mobile-footer'
      : '',
  ]
    .filter(Boolean)
    .join(' '),
)

const hasActionsSlot = computed(() => !!slots.actions)
const showHeaderExtra = computed(
  () => !!slots.extra || (hasActionsSlot.value && !isMobileViewport.value),
)

watch(
  () => props.open,
  (open) => {
    if (open) push()
    else pop()
  },
  { immediate: true },
)

function onAfterOpenChange(open: boolean): void {
  if (open) {
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
        <slot v-if="!isMobileViewport" name="actions" />
      </div>
    </template>
    <template v-if="isMobileViewport && $slots.actions" #footer>
      <div class="kp-form-drawer__footer-actions">
        <slot name="actions" />
      </div>
    </template>
  </Drawer>
</template>
