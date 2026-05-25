<script setup lang="ts" generic="T">
import { computed } from 'vue'
import { Tag } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { resolveKpColumnTag } from '@/core/util/table-columns'

const props = defineProps<{
  column: TableColumnType<T>
  record: T
}>()

const tag = computed(() => resolveKpColumnTag(props.column, props.record))
</script>

<template>
  <Tag v-if="tag" :color="tag.color">{{ tag.label }}</Tag>
  <slot v-else />
</template>
