<script setup lang="ts">
import { FormItem, Switch, Typography } from 'ant-design-vue'

const sensitive = defineModel<boolean>('sensitive', { default: false })
const archived = defineModel<boolean>('archived', { default: false })
</script>

<template>
  <FormItem class="kp-record-status">
    <div class="kp-record-status__row">
      <label class="kp-record-status__toggle">
        <span class="kp-record-status__label">Hassas kayıt</span>
        <Switch v-model:checked="sensitive" />
      </label>
      <label class="kp-record-status__toggle">
        <span class="kp-record-status__label">Arşivli</span>
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
}

.kp-record-status__label {
  font-size: 14px;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  user-select: none;
}

.kp-record-status__hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
}
</style>
