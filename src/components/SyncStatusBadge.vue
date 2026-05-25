<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Tag } from 'ant-design-vue'
import { CloudSyncOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import KpTooltip from '@/components/KpTooltip.vue'
import { useSyncStore, type SyncRuntimeStatus } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'

const props = withDefaults(
  defineProps<{
    /** Navbar (masaüstü) veya sol menü (mobil). */
    layout?: 'navbar' | 'menu'
  }>(),
  { layout: 'navbar' },
)

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const router = useRouter()

const visible = computed(
  () => syncStore.enabled && syncStore.loaded && profileStore.unlocked,
)

const statusMeta = computed((): { label: string; color: string; pulse?: boolean } => {
  const status: SyncRuntimeStatus = syncStore.runtimeStatus
  if (syncStore.syncing) {
    return { label: 'Senkronize ediliyor…', color: 'processing', pulse: true }
  }
  switch (status) {
    case 'pending_push':
      return { label: 'Yazma bekliyor', color: 'processing' }
    case 'remote_pending':
      return { label: 'Uzak güncelleme', color: 'warning' }
    case 'conflict':
      return { label: 'Çakışma', color: 'error' }
    case 'profile_mismatch':
      return { label: 'Profil uyuşmazlığı', color: 'warning' }
    case 'error':
      return { label: 'Senkron hatası', color: 'error' }
    case 'pending_file':
      return { label: 'Dosya seçilmedi', color: 'warning' }
    case 'idle':
      return { label: 'Senkron güncel', color: 'success' }
    default:
      return { label: 'Senkron', color: 'default' }
  }
})

const tooltip = computed(() => {
  if (syncStore.profileMismatch) {
    return `Dosya «${syncStore.profileMismatch.fileProfileName}» profiline ait — Ayarlar → Veri'den bağlayın`
  }
  if (syncStore.conflictPending) {
    return 'Yerel ve uzak sürüm ayrıştı — tıklayın ve çözün'
  }
  if (syncStore.config.lastError) {
    return syncStore.config.lastError
  }
  if (syncStore.activeFileName) {
    return `Senkron dosyası: ${syncStore.activeFileName}`
  }
  return 'Senkron ayarları'
})

function onClick(): void {
  if (syncStore.conflictPending) {
    syncStore.openConflictModal()
    return
  }
  router.push({ name: 'settings', query: { tab: 'sync' } })
}
</script>

<template>
  <KpTooltip v-if="visible" :title="tooltip">
    <Tag
      class="kp-sync-badge"
      :class="{
        'kp-sync-badge--pulse': statusMeta.pulse,
        'kp-sync-badge--menu': props.layout === 'menu',
      }"
      :size="props.layout === 'menu' ? 'small' : 'default'"
      :color="statusMeta.color"
      role="button"
      tabindex="0"
      @click="onClick"
      @keydown.enter="onClick"
    >
      <LoadingOutlined v-if="syncStore.syncing" spin />
      <CloudSyncOutlined v-else />
      {{ statusMeta.label }}
    </Tag>
  </KpTooltip>
</template>

<style scoped>
.kp-sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  cursor: pointer;
  user-select: none;
}

.kp-sync-badge--menu {
  margin: 0;
  max-width: 100%;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.kp-sync-badge--pulse {
  animation: kp-sync-pulse 1.2s ease-in-out infinite;
}

@keyframes kp-sync-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}
</style>
