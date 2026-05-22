<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/core/util/markdown'

const props = defineProps<{
  source: string
}>()

const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="kp-markdown" v-html="html" />
</template>

<style scoped>
.kp-markdown {
  font-size: inherit;
  line-height: 1.55;
  word-break: break-word;
}

.kp-markdown :deep(p) {
  margin: 0 0 0.65em;
}

.kp-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.kp-markdown :deep(h1),
.kp-markdown :deep(h2),
.kp-markdown :deep(h3),
.kp-markdown :deep(h4) {
  margin: 0.85em 0 0.4em;
  font-weight: 600;
  line-height: 1.35;
}

.kp-markdown :deep(h1:first-child),
.kp-markdown :deep(h2:first-child),
.kp-markdown :deep(h3:first-child),
.kp-markdown :deep(h4:first-child) {
  margin-top: 0;
}

.kp-markdown :deep(ul),
.kp-markdown :deep(ol) {
  margin: 0 0 0.65em;
  padding-left: 1.35em;
}

.kp-markdown :deep(li + li) {
  margin-top: 0.25em;
}

.kp-markdown :deep(blockquote) {
  margin: 0 0 0.65em;
  padding: 0.35em 0 0.35em 0.85em;
  border-left: 3px solid rgba(0, 0, 0, 0.15);
  color: rgba(0, 0, 0, 0.65);
}

.kp-markdown :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.92em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
}

.kp-markdown :deep(pre) {
  margin: 0 0 0.65em;
  padding: 10px 12px;
  border-radius: 6px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.kp-markdown :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: 0.88em;
}

.kp-markdown :deep(a) {
  color: #1677ff;
}

.kp-markdown :deep(table) {
  width: 100%;
  margin: 0 0 0.65em;
  border-collapse: collapse;
  font-size: 0.92em;
}

.kp-markdown :deep(th),
.kp-markdown :deep(td) {
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 6px 8px;
  text-align: left;
}

.kp-markdown :deep(th) {
  background: rgba(0, 0, 0, 0.04);
}

[data-theme='dark'] .kp-markdown :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.55);
}

[data-theme='dark'] .kp-markdown :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-markdown :deep(pre) {
  background: rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme='dark'] .kp-markdown :deep(a) {
  color: #4096ff;
}

[data-theme='dark'] .kp-markdown :deep(th),
[data-theme='dark'] .kp-markdown :deep(td) {
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme='dark'] .kp-markdown :deep(th) {
  background: rgba(255, 255, 255, 0.06);
}
</style>
