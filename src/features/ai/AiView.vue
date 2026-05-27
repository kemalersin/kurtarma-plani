<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Alert, Button, Typography } from 'ant-design-vue'
import { SettingOutlined } from '@ant-design/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import KpNotice from '@/components/KpNotice.vue'
import KpAiChatPanel from '@/components/KpAiChatPanel.vue'
import { resolveAiChatPlaceholder } from '@/features/ai/page-chat'
import { useAiStore } from '@/stores/ai'
import { useConnectivity } from '@/composables/useConnectivity'

const ai = useAiStore()
const router = useRouter()
const route = useRoute()
const { online } = useConnectivity()

const chatExpanded = ref(false)

const placeholder = computed(() => resolveAiChatPlaceholder(route))
const hasProviders = computed(() => (ai.settings?.providers.length ?? 0) > 0)

onMounted(async () => {
  if (!ai.loaded) await ai.load()
  await ai.switchSession('ai')
  window.addEventListener('keydown', onEscapeKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscapeKey)
  document.body.style.overflow = ''
})

function onEscapeKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && chatExpanded.value) chatExpanded.value = false
}

watch(chatExpanded, (expanded) => {
  document.body.style.overflow = expanded ? 'hidden' : ''
})
</script>

<template>
  <div class="kp-ai-page" :class="{ 'kp-ai-page--expanded': chatExpanded }">
    <template v-if="!chatExpanded">
      <PageHeader
        class="kp-ai-page__header"
        title="AI Asistan"
        subtitle="Finans verileriniz üzerinde analiz ve planlama (yalnızca çevrimiçi)."
      />

      <KpNotice
        v-if="!online"
        tone="warning"
        title="Çevrimdışısınız"
        detail="AI sohbet yalnızca internet bağlantısı varken kullanılabilir. Finans modülleri çevrimdışı çalışmaya devam eder."
        class="kp-ai-page__notice"
      />

      <Alert
        v-else-if="ai.loaded && !hasProviders"
        type="info"
        show-icon
        message="AI sağlayıcısı yapılandırılmadı"
        class="kp-ai-page__notice"
      >
        <template #description>
          <Typography.Paragraph class="kp-ai-page__alert-desc">
            Ayarlar → AI sekmesinden API anahtarı ve model ekleyin.
          </Typography.Paragraph>
          <Button type="primary" size="small" @click="router.push({ name: 'settings', query: { tab: 'ai' } })">
            <SettingOutlined />
            AI ayarlarına git
          </Button>
        </template>
      </Alert>
    </template>

    <KpAiChatPanel
      v-model:expanded="chatExpanded"
      :empty-hint="placeholder"
      expandable
    />
  </div>
</template>

<style scoped>
.kp-ai-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.kp-ai-page--expanded {
  position: fixed;
  inset: 0;
  z-index: 300;
  flex: none;
  height: auto;
  padding: 12px;
  box-sizing: border-box;
  background: var(--kp-bg, #f5f5f7);
  overflow: hidden;
}

.kp-ai-page__header {
  flex-shrink: 0;
}

.kp-ai-page__notice {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.kp-ai-page__alert-desc {
  margin-bottom: 8px;
}

[data-theme='dark'] .kp-ai-page--expanded {
  background: var(--kp-bg, #141416);
}
</style>
