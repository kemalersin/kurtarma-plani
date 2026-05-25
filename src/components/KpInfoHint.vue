<script setup lang="ts">
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import KpTooltip from '@/components/KpTooltip.vue'

/** Form etiketi / istatistik yanında bilgi ikonu — hover ve tıklama ile açılır. */
defineProps<{
  title: string
}>()
</script>

<template>
  <KpTooltip hint :title="title">
    <InfoCircleOutlined class="kp-info-hint__icon" aria-hidden="true" />
  </KpTooltip>
</template>
