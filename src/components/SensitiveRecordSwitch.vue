<script setup lang="ts">
import { FormItem, Switch, Typography } from 'ant-design-vue'

const sensitive = defineModel<boolean>('sensitive', { default: false })
const archived = defineModel<boolean>('archived', { default: false })
</script>

<template>
  <FormItem class="kp-record-status">
    <div class="kp-record-status__row">
      <label class="kp-record-status__toggle">
        <Typography.Text>Hassas kayıt</Typography.Text>
        <Switch v-model:checked="sensitive" />
      </label>
      <label class="kp-record-status__toggle">
        <Typography.Text>Arşivli</Typography.Text>
        <Switch v-model:checked="archived" />
      </label>
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

.kp-record-status__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
}

.kp-record-status__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  cursor: pointer;
  user-select: none;
}

.kp-record-status__hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
}
</style>
