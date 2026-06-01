<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Button,
  Form,
  FormItem,
  Input,
  Radio,
  Space,
  Typography,
  message,
} from 'ant-design-vue'
import { CopyOutlined, LinkOutlined, MobileOutlined, SafetyOutlined } from '@ant-design/icons-vue'
import FormDrawer from '@/components/FormDrawer.vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { RelayPairingMode } from '@/core/types/relay-pairing'
import { relayErrorMessageFromUnknown } from '@/core/services/sync/relay-errors'
import { pairingQrDataUrl } from '@/core/services/sync/relay-pairing-qr'

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const { formatDateTimeLong } = useLocaleFormatters()

const guestCode = ref('')
const recoveryPhrase = ref('')

const open = computed({
  get: () => syncStore.relayPairingDrawerOpen,
  set: (value: boolean) => {
    if (value) {
      syncStore.relayPairingDrawerOpen = true
    } else {
      syncStore.closeRelayPairingDrawer()
    }
  },
})

const mode = computed({
  get: () => syncStore.relayPairingMode,
  set: (value: RelayPairingMode) => {
    syncStore.relayPairingMode = value
  },
})

const hostState = computed(() => syncStore.relayPairingHost)

const hostQrSrc = computed(() => {
  const payload = hostState.value?.qrPayload?.trim()
  if (!payload) return ''
  try {
    return pairingQrDataUrl(payload)
  } catch {
    return ''
  }
})
const loading = computed(() => syncStore.relayPairingLoading || syncStore.syncing)
const relayReady = computed(() => syncStore.syncTransportReady)
const activeProfileId = computed(() => profileStore.activeProfile?.id ?? '')

watch(open, (visible) => {
  if (visible) {
    guestCode.value = ''
    recoveryPhrase.value = ''
  }
})

async function onGenerateCode(): Promise<void> {
  try {
    await syncStore.startRelayPairingHost()
    const code = syncStore.relayPairingHost?.code
    if (code) {
      await copyText('Eşleştirme kodu', code)
    }
  } catch (error) {
    message.error(relayErrorMessageFromUnknown(error))
  }
}

async function onJoin(): Promise<void> {
  try {
    await syncStore.joinRelayPairing(guestCode.value)
    message.success('Cihaz eşleştirildi; veri senkronize edildi.')
  } catch (error) {
    message.error(relayErrorMessageFromUnknown(error))
  }
}

async function onRecover(): Promise<void> {
  try {
    await syncStore.recoverRelayWithPhrase(recoveryPhrase.value)
    message.success('Recovery tamamlandı; cihaz yeniden bağlandı.')
  } catch (error) {
    message.error(relayErrorMessageFromUnknown(error))
  }
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
</script>

<template>
  <FormDrawer
    stack-id="sync-pairing"
    v-model:open="open"
    title="Cihaz eşleştirme ve recovery"
    width="min(520px, 100vw)"
    :mask-closable="!loading"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <DismissibleDrawerAlert
        hint-key="sync.pairing.namespace"
        type="info"
        message="Profil = namespace"
        description="Aktif profil kimliği relay namespace'idir. İkinci cihazda aynı namespace gerekir (kurulumda Senkronla veya yedek içe aktarma)."
      />

      <Radio.Group
        v-model:value="mode"
        class="kp-sync-pairing-mode"
        button-style="solid"
        :disabled="loading"
      >
        <Radio.Button value="host">
          <MobileOutlined />
          Cihaz ekle<span class="kp-sync-pairing-mode__host-suffix"> (host)</span>
        </Radio.Button>
        <Radio.Button value="guest">
          <LinkOutlined /> Cihaza katıl
        </Radio.Button>
        <Radio.Button value="recover">
          <SafetyOutlined /> Recovery
        </Radio.Button>
      </Radio.Group>

      <template v-if="mode === 'host'">
        <Typography.Paragraph type="secondary" class="kp-sync-pairing-hint">
          Bağlı bir cihazdan 6 haneli kod üretin. Yeni cihaz kurulumda «QR payload kopyala»yı
          yapıştırabilir; yalnızca kod için alttaki profil kimliğini de paylaşın.
        </Typography.Paragraph>
        <Button
          type="primary"
          :loading="loading"
          :disabled="!relayReady && !syncStore.isRelayMode"
          @click="onGenerateCode"
        >
          Eşleştirme kodu üret
        </Button>
        <template v-if="hostState">
          <div class="kp-sync-pairing-code">{{ hostState.code }}</div>
          <img
            v-if="hostQrSrc"
            class="kp-sync-pairing-qr"
            :src="hostQrSrc"
            width="220"
            height="220"
            alt="Eşleştirme QR kodu — yeni cihazda tarayın veya QR payload kopyalayın"
          />
          <div class="kp-sync-pairing-host-meta">
            <Typography.Text type="secondary" class="kp-sync-pairing-host-meta__expires">
              Geçerlilik: {{ formatDateTimeLong(hostState.expiresAt) }}
            </Typography.Text>
            <Space wrap class="kp-sync-pairing-host-meta__actions">
              <Button size="small" @click="copyText('Kod', hostState.code)">
                <template #icon><CopyOutlined /></template>
                Kodu kopyala
              </Button>
              <Button size="small" @click="copyText('QR payload', hostState.qrPayload)">
                <template #icon><CopyOutlined /></template>
                QR payload kopyala
              </Button>
            </Space>
          </div>
        </template>
      </template>

      <template v-else-if="mode === 'guest'">
        <Typography.Paragraph type="secondary" class="kp-sync-pairing-hint">
          Host cihazdaki 6 haneli kodu girin. Bu cihazdaki profil, host ile aynı namespace kimliğine sahip olmalıdır.
        </Typography.Paragraph>
        <Form layout="vertical" :colon="false" @submit.prevent="onJoin">
          <FormItem label="Eşleştirme kodu" required>
            <Input
              v-model:value="guestCode"
              inputmode="numeric"
              :maxlength="6"
              placeholder="847291"
              :disabled="loading"
            />
          </FormItem>
          <Button
            type="primary"
            block
            html-type="submit"
            :loading="loading"
            :disabled="guestCode.replace(/\D/g, '').length !== 6"
          >
            Katıl ve senkronize et
          </Button>
        </Form>
      </template>

      <template v-else>
        <Typography.Paragraph type="secondary" class="kp-sync-pairing-hint">
          24 kelimelik recovery anahtarı ile tüm cihazları iptal edip bu cihazı yeni host yapın. Anahtar profil parolasından ayrıdır.
        </Typography.Paragraph>
        <Form layout="vertical" :colon="false" @submit.prevent="onRecover">
          <FormItem label="Recovery anahtarı (24 kelime)" required>
            <Input.TextArea
              v-model:value="recoveryPhrase"
              :rows="4"
              placeholder="word1 word2 … word24"
              :disabled="loading"
            />
          </FormItem>
        </Form>
      </template>

      <div v-if="activeProfileId" class="kp-sync-pairing-profile-id">
        <Typography.Text type="secondary" class="kp-sync-pairing-profile-id__label">
          Profil kimliği
        </Typography.Text>
        <div class="kp-sync-pairing-profile-id__row">
          <Typography.Text code class="kp-sync-pairing-profile-id__value">
            {{ activeProfileId }}
          </Typography.Text>
          <Button
            size="small"
            :disabled="loading"
            @click="copyText('Profil kimliği', activeProfileId)"
          >
            <template #icon><CopyOutlined /></template>
            Kopyala
          </Button>
        </div>
      </div>
    </Space>

    <template v-if="mode !== 'host'" #actions>
      <Space>
        <Button :disabled="loading" @click="open = false">Vazgeç</Button>
        <Button
          v-if="mode === 'recover'"
          type="primary"
          :loading="loading"
          :disabled="!recoveryPhrase.trim()"
          @click="onRecover"
        >
          Recovery ile bağlan
        </Button>
      </Space>
    </template>
  </FormDrawer>
</template>

<style scoped>
.kp-sync-pairing-mode {
  display: flex;
  width: 100%;
}

.kp-sync-pairing-mode :deep(.ant-radio-button-wrapper) {
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding-inline: 6px;
  text-align: center;
  white-space: normal;
  line-height: 1.25;
}

@media (max-width: 768px) {
  .kp-sync-pairing-mode__host-suffix {
    display: none;
  }
}

.kp-sync-pairing-hint {
  margin-bottom: 0;
}

.kp-sync-pairing-profile-id {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

[data-theme='dark'] .kp-sync-pairing-profile-id {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.kp-sync-pairing-profile-id__label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.kp-sync-pairing-profile-id__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.kp-sync-pairing-profile-id__value {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  word-break: break-all;
}

.kp-sync-pairing-code {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: 0.35em;
  text-align: center;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  padding: 12px 0 4px;
}

.kp-sync-pairing-qr {
  display: block;
  width: 220px;
  height: 220px;
  margin: 8px auto 4px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.kp-sync-pairing-host-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
}

.kp-sync-pairing-host-meta__expires {
  display: block;
}

.kp-sync-pairing-host-meta__actions {
  justify-content: center;
  width: 100%;
}
</style>
