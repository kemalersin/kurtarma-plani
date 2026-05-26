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
    class="kp-dismissible-drawer-alert"
    :type="type"
    :message="message"
    :description="description"
    :show-icon="showIcon"
    closable
    @close="dismiss"
  />
</template>

<style>
/* Form drawer: alert ile alttaki içerik arası boşluk yalnız alert görünürken */
.kp-dismissible-drawer-alert {
  margin-bottom: 16px;
}

/* kp-drawer-table-page zaten gap kullanır; kapatılınca DOM yok → boşluk kalmaz */
.kp-drawer-table-page > .kp-dismissible-drawer-alert {
  margin-bottom: 0;
}
</style>
