<script setup lang="ts">
import { Popover } from 'ant-design-vue'
import { ref, useSlots } from 'vue'
import FormDrawer from '@/components/FormDrawer.vue'
import { useMobileViewport } from '@/composables/useMatchMedia'
import { listFilterPopoverProps, type ListFilterPopoverProps } from '@/core/ui/list-filter-popover'

const open = defineModel<boolean>('open', { default: false })

withDefaults(
  defineProps<{
    /** Mobilde `FormDrawer` stack kimliği (sekmeli sayfalarda benzersiz olmalı). */
    stackId?: string
    title?: string
    popoverProps?: ListFilterPopoverProps
  }>(),
  {
    stackId: 'list-filter',
    title: 'Filtreler',
    popoverProps: () => listFilterPopoverProps,
  },
)

const slots = useSlots()
const isMobileViewport = useMobileViewport()
const triggerRef = ref<HTMLElement | null>(null)

defineExpose({ triggerRef })

function openDrawer(): void {
  open.value = true
}
</script>

<template>
  <Popover
    v-if="!isMobileViewport"
    v-model:open="open"
    v-bind="popoverProps"
  >
    <template #content>
      <div class="kp-list-filter">
        <slot />
        <footer v-if="slots.footer" class="kp-list-filter__foot">
          <slot name="footer" />
        </footer>
      </div>
    </template>
    <div ref="triggerRef" class="kp-list-filter-overlay__trigger">
      <slot name="trigger" />
    </div>
  </Popover>

  <template v-else>
    <div
      ref="triggerRef"
      class="kp-list-filter-overlay__trigger"
      @click="openDrawer"
    >
      <slot name="trigger" />
    </div>

    <FormDrawer
      :stack-id="stackId"
      :open="!!open"
      :title="title"
      drawer-class="kp-form-drawer--list-filter"
      @update:open="open = $event"
    >
      <div class="kp-list-filter kp-list-filter--drawer">
        <slot />
      </div>
      <template v-if="slots.footer" #actions>
        <slot name="footer" />
      </template>
    </FormDrawer>
  </template>
</template>

<style scoped>
.kp-list-filter-overlay__trigger {
  display: inline-flex;
  align-items: center;
}
</style>
