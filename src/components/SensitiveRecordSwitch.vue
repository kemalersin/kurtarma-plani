<script setup lang="ts">
import { FormItem, Switch, Typography } from 'ant-design-vue'

const sensitive = defineModel<boolean>('sensitive', { default: false })
const archived = defineModel<boolean>('archived', { default: false })
</script>

<template>
  <FormItem class="kp-record-status">
    <div class="kp-form-toggle-grid">
      <div class="kp-form-toggle-pair">
        <Switch v-model:checked="sensitive" />
        <Typography.Text class="kp-form-toggle-pair__label">Hassas kayıt</Typography.Text>
      </div>
      <div class="kp-form-toggle-pair">
        <Switch v-model:checked="archived" />
        <Typography.Text class="kp-form-toggle-pair__label">Arşivli</Typography.Text>
      </div>
    </div>
    <Typography.Paragraph type="secondary" class="kp-record-status__hint">
      Hassas kayıtlar AI snapshot ve dışa aktarımdan (varsayılan) hariç tutulur.
    </Typography.Paragraph>
  </FormItem>
</template>

<style scoped>
.kp-record-status :deep(.ant-form-item-control-input) {
  min-height: 0;
}

.kp-record-status__hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
}
</style>
