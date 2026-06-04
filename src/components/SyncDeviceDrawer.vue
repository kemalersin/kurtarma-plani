<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  Alert,
  Button,
  Empty,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'ant-design-vue'
import {
  ClockCircleOutlined,
  CopyOutlined,
  MobileOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons-vue'
import FormDrawer from '@/components/FormDrawer.vue'
import KpTooltip from '@/components/KpTooltip.vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import type { RelayDeviceInfo } from '@/core/types/relay-devices'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const { formatDateTimeLong } = useLocaleFormatters()

const drawerOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const snapshot = computed(() => syncStore.relayDevices)
const limits = computed(() => snapshot.value?.limits)
const loading = computed(() => syncStore.relayDevicesLoading || syncStore.syncing)
const relayReady = computed(() => syncStore.syncTransportReady && syncStore.isRelayMode)

const sortedDevices = computed(() => {
  const list = [...(snapshot.value?.devices ?? [])]
  return list.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    const ta = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0
    const tb = b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0
    return tb - ta
  })
})

const limitPercent = computed(() => {
  if (!limits.value || limits.value.maxDevices <= 0) return 0
  return Math.min(
    100,
    Math.round((limits.value.activeDevices / limits.value.maxDevices) * 100),
  )
})

function deviceLabel(device: RelayDeviceInfo): string | null {
  const label = device.label.trim()
  return label || null
}

function formatLastSeenTooltip(value: string | null): string {
  if (!value) return 'Henüz görülmedi'
  return formatDateTimeLong(value)
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Henüz görülmedi'
  const loc = profileStore.activeProfile?.localeSettings.locale ?? 'tr-TR'
  const tz = profileStore.activeProfile?.localeSettings.timeZone ?? 'Europe/Istanbul'
  return new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function copyText(label: string, value: string): Promise<void> {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    message.success(`${label} panoya kopyalandı.`)
  } catch {
    message.error('Panoya kopyalanamadı.')
  }
}

async function reload(): Promise<void> {
  if (!relayReady.value) return
  try {
    await syncStore.refreshRelayDevices()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Cihaz listesi alınamadı.')
  }
}

async function onRevoke(device: RelayDeviceInfo): Promise<void> {
  try {
    await syncStore.revokeRelayDevice(device.deviceId)
    message.success('Cihaz erişimi kaldırıldı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Cihaz kaldırılamadı.')
  }
}

watch([drawerOpen, relayReady], ([visible, ready]) => {
  if (visible && ready) {
    void reload()
  }
})
</script>

<template>
  <FormDrawer
    stack-id="sync-devices"
    v-model:open="drawerOpen"
    title="Relay cihazları"
    width="min(480px, 100vw)"
    :mask-closable="!loading"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <Alert
        v-if="!relayReady"
        type="warning"
        show-icon
        message="Relay bağlantısı yok"
        description="Sunucu adresini kaydedip «Senkron ayarlarını kaydet» ile bağlantıyı kurun."
      />

      <Alert
        v-if="syncStore.relayDeviceLimitContext?.code === 'DEVICE_LIMIT_BLOCKED'"
        type="error"
        show-icon
        closable
        message="Cihaz limiti doldu"
        description="Yeni cihaz eklemek için kullanılmayan bir cihazı kaldırın veya recovery ile yeniden başlayın."
        @close="syncStore.dismissRelayDeviceLimitAlert()"
      />

      <div v-if="limits && relayReady" class="kp-relay-device-quota">
        <div class="kp-relay-device-quota__head">
          <Typography.Text strong>Bağlı cihazlar</Typography.Text>
          <Typography.Text type="secondary" class="kp-relay-device-quota__count">
            {{ limits.activeDevices }} / {{ limits.maxDevices }}
          </Typography.Text>
        </div>
        <Progress
          :percent="limitPercent"
          :show-info="false"
          size="small"
          :status="limitPercent >= 100 ? 'exception' : 'normal'"
        />
        <Typography.Text type="secondary" class="kp-relay-device-quota__detail">
          Ücretsiz kota: {{ limits.freeDeviceLimit }} cihaz
          <template v-if="limits.purchasedSlots > 0">
            · ek slot +{{ limits.purchasedSlots }}
          </template>
        </Typography.Text>
      </div>

      <Spin :spinning="loading && relayReady">
        <ul v-if="sortedDevices.length" class="kp-relay-device-list">
          <li
            v-for="device in sortedDevices"
            :key="device.deviceId"
            class="kp-relay-device-card"
            :class="{ 'kp-relay-device-card--current': device.isCurrent }"
          >
            <div class="kp-relay-device-card__id-block">
              <div class="kp-relay-device-card__id-block-head">
                <Typography.Text type="secondary" class="kp-relay-device-card__meta-label">
                  Cihaz kimliği
                </Typography.Text>
                <Popconfirm
                  v-if="!device.isCurrent"
                  title="Bu cihazın Senkronla erişimi kaldırılsın mı?"
                  ok-text="Kaldır"
                  cancel-text="Vazgeç"
                  :ok-button-props="{ danger: true }"
                  @confirm="onRevoke(device)"
                >
                  <Button
                    size="small"
                    danger
                    class="kp-relay-device-card__revoke"
                    :disabled="loading"
                    @click.stop
                  >
                    <template #icon><StopOutlined /></template>
                    Kaldır
                  </Button>
                </Popconfirm>
              </div>
              <div class="kp-relay-device-card__id-shell">
                <MobileOutlined class="kp-relay-device-card__icon" aria-hidden="true" />
                <code class="kp-relay-device-card__id">{{ device.deviceId }}</code>
                <Tag
                  v-if="device.isCurrent"
                  color="processing"
                  class="kp-relay-device-card__tag"
                >
                  Bu cihaz
                </Tag>
                <Button
                  type="text"
                  size="small"
                  class="kp-relay-device-card__copy"
                  :disabled="loading"
                  aria-label="Cihaz kimliğini kopyala"
                  @click.stop="copyText('Cihaz kimliği', device.deviceId)"
                >
                  <template #icon><CopyOutlined /></template>
                </Button>
              </div>
            </div>

            <div v-if="deviceLabel(device)" class="kp-relay-device-card__label-wrap">
              <KpTooltip :title="deviceLabel(device)!">
                <p class="kp-relay-device-card__label">{{ deviceLabel(device) }}</p>
              </KpTooltip>
            </div>

            <KpTooltip :title="formatLastSeenTooltip(device.lastSeenAt)">
              <div class="kp-relay-device-card__seen">
                <ClockCircleOutlined aria-hidden="true" />
                <span>{{ formatLastSeen(device.lastSeenAt) }}</span>
              </div>
            </KpTooltip>
          </li>
        </ul>
        <Empty
          v-else-if="relayReady && !loading"
          description="Kayıtlı cihaz yok"
          class="kp-relay-device-list__empty"
        />
      </Spin>
    </Space>

    <template #actions>
      <Space :size="8">
        <Button :disabled="loading" @click="drawerOpen = false">Kapat</Button>
        <Button type="primary" :loading="loading" :disabled="!relayReady" @click="reload">
          <template #icon><ReloadOutlined /></template>
          Yenile
        </Button>
      </Space>
    </template>
  </FormDrawer>
</template>

<style scoped>
.kp-relay-device-quota {
  padding: 12px 14px;
  border-radius: var(--kp-radius, 8px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

[data-theme='dark'] .kp-relay-device-quota {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.kp-relay-device-quota__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.kp-relay-device-quota__count {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.kp-relay-device-quota__detail {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
}

.kp-relay-device-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kp-relay-device-list__empty {
  margin: 24px 0;
}

.kp-relay-device-card {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--kp-radius, 8px);
  padding: 12px 14px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

[data-theme='dark'] .kp-relay-device-card {
  background: #1f1f1f;
  border-color: rgba(255, 255, 255, 0.08);
}

.kp-relay-device-card--current {
  border-color: rgba(22, 119, 255, 0.45);
  box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.12);
}

[data-theme='dark'] .kp-relay-device-card--current {
  border-color: rgba(64, 150, 255, 0.5);
  box-shadow: 0 0 0 1px rgba(64, 150, 255, 0.2);
}

.kp-relay-device-card__id-block {
  min-width: 0;
}

.kp-relay-device-card__id-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.kp-relay-device-card__meta-label {
  font-size: 11px;
  line-height: 1.3;
}

.kp-relay-device-card__revoke {
  flex-shrink: 0;
}

.kp-relay-device-card__id-shell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.04);
}

[data-theme='dark'] .kp-relay-device-card__id-shell {
  background: rgba(255, 255, 255, 0.06);
}

.kp-relay-device-card__icon {
  flex-shrink: 0;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.45);
}

[data-theme='dark'] .kp-relay-device-card__icon {
  color: rgba(255, 255, 255, 0.45);
}

.kp-relay-device-card__id {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  background: none;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  word-break: break-all;
  color: rgba(0, 0, 0, 0.88);
}

[data-theme='dark'] .kp-relay-device-card__id {
  color: rgba(255, 255, 255, 0.88);
}

.kp-relay-device-card__tag {
  flex-shrink: 0;
  margin: 0;
  font-size: 11px;
  line-height: 18px;
}

.kp-relay-device-card__copy {
  flex-shrink: 0;
  margin: 0 -4px 0 0;
}

.kp-relay-device-card__label-wrap {
  min-width: 0;
}

.kp-relay-device-card__label {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

[data-theme='dark'] .kp-relay-device-card__label {
  color: rgba(255, 255, 255, 0.5);
}

.kp-relay-device-card__seen {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.5);
}

.kp-relay-device-card__seen span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-theme='dark'] .kp-relay-device-card__seen {
  color: rgba(255, 255, 255, 0.5);
}
</style>
