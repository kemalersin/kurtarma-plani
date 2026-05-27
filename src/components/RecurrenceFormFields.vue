<script setup lang="ts">
import { computed } from 'vue'
import { FormItem, Switch, Typography } from 'ant-design-vue'
import KpSelect from '@/components/KpSelect.vue'
import {
  RECURRENCE_LABELS,
  RecurrenceIntervals,
  type RecurrenceInterval,
} from '@/core/types/recurrence'

const recurring = defineModel<boolean>('recurring', { default: false })
const interval = defineModel<RecurrenceInterval | undefined>('interval')
const realized = defineModel<boolean>('realized', { default: false })

const intervalOptions = computed(() =>
  RecurrenceIntervals.map((value) => ({
    value,
    label: RECURRENCE_LABELS[value],
  })),
)
</script>

<template>
  <FormItem class="kp-recurrence-row">
    <div class="kp-form-toggle-grid">
      <div class="kp-form-toggle-pair">
        <Switch v-model:checked="recurring" />
        <Typography.Text class="kp-form-toggle-pair__label">Yinelenen</Typography.Text>
      </div>
      <div v-if="!recurring" class="kp-form-toggle-pair">
        <Switch v-model:checked="realized" />
        <Typography.Text class="kp-form-toggle-pair__label">Gerçekleşti</Typography.Text>
      </div>
    </div>
  </FormItem>

  <FormItem v-if="recurring" label="Yinelenme aralığı" required>
    <KpSelect
      v-model:value="interval"
      :options="intervalOptions"
      placeholder="Aralık seçin"
    />
  </FormItem>

  <Typography.Paragraph v-if="recurring" type="secondary" class="kp-recurrence-hint">
    Yinelenen kayıtlar otomatik gerçekleşmiş sayılır; plan tarihi ilk yinelenmedir.
  </Typography.Paragraph>
</template>

<style scoped>
.kp-recurrence-row :deep(.ant-form-item-control-input) {
  min-height: auto;
}

.kp-recurrence-hint {
  margin: -4px 0 8px;
  font-size: 12px;
}
</style>
