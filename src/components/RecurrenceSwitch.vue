<script setup lang="ts">
import { Switch } from 'ant-design-vue'

const recurring = defineModel<boolean>('recurring', { default: false })
</script>

<template>
  <Switch
    v-model:checked="recurring"
    checked-children="Yinele"
    un-checked-children="Yinele"
    class="kp-recurrence-switch"
  />
</template>

<style scoped>
.kp-recurrence-switch {
  flex-shrink: 0;
}
</style>
