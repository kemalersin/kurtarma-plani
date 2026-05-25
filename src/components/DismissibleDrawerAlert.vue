<script setup lang="ts">
import { Alert } from 'ant-design-vue'
import type { AlertProps } from 'ant-design-vue/es/alert'
import { useDismissibleHint } from '@/composables/useDismissibleHint'

const props = withDefaults(
  defineProps<{
    hintKey: string
    type?: AlertProps['type']
    message?: AlertProps['message']
    description?: AlertProps['description']
    showIcon?: boolean
  }>(),
  {
    type: 'info',
    showIcon: true,
  },
)

const { visible, dismiss } = useDismissibleHint(props.hintKey)
</script>

<template>
  <Alert
    v-if="visible"
    :type="type"
    :message="message"
    :description="description"
    :show-icon="showIcon"
    closable
    @close="dismiss"
  />
</template>
