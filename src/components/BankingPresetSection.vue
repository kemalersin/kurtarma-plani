<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'ant-design-vue'
import KpTooltip from '@/components/KpTooltip.vue'
import {
  CloudDownloadOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import { useBankingPresetStore } from '@/stores/banking-preset'
import { useConnectivity } from '@/composables/useConnectivity'
import { DEFAULT_BANKING_PRESET_FEED_URL } from '@/core/constants'
import { BUNDLED_BANKING_PRESET } from '@/data/banking-presets'
import JsonCodeBlock from '@/components/JsonCodeBlock.vue'

const store = useBankingPresetStore()
const { online } = useConnectivity()

const feedUrl = ref<string>(DEFAULT_BANKING_PRESET_FEED_URL)
const fileInput = ref<HTMLInputElement | null>(null)
const importBusy = ref(false)

const updatedAtText = computed(() => {
  const value = store.active.updatedAt
  if (!value) return 'Derlemeyle gelen varsayılan'
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
})

const sourceTagColor = computed(() => {
  switch (store.active.source) {
    case 'remote':
      return 'blue'
    case 'import':
      return 'gold'
    default:
      return 'default'
  }
})

const sourceLabel = computed(() => {
  switch (store.active.source) {
    case 'remote':
      return 'Uzak feed'
    case 'import':
      return 'Dosyadan içe aktarıldı'
    default:
      return 'Derleme gömülü'
  }
})

onMounted(async () => {
  await store.load()
})

async function refreshFromFeed(): Promise<void> {
  if (!online.value) {
    message.warning('Çevrimdışısınız; feed güncellemesi yapılamıyor.')
    return
  }
  const ok = await store.refreshFromFeed(feedUrl.value)
  if (ok) message.success('Bankacılık referansı güncellendi.')
  else message.error(store.lastError ?? 'Güncelleme başarısız.')
}

function chooseFile(): void {
  fileInput.value?.click()
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importBusy.value = true
  try {
    const text = await file.text()
    const ok = await store.importFromText(text)
    if (ok) message.success('Bankacılık referansı içe aktarıldı.')
    else message.error(store.lastError ?? 'Dosya geçersiz.')
  } finally {
    importBusy.value = false
  }
}

function confirmReset(): void {
  Modal.confirm({
    title: 'Derleme varsayılanına dön',
    content:
      'IndexedDB üzerindeki bankacılık referans kaydı silinecek ve uygulamayla gelen varsayılan tekrar kullanılacak.',
    okText: 'Sıfırla',
    cancelText: 'Vazgeç',
    okButtonProps: { danger: true },
    async onOk() {
      await store.resetToBundled()
      message.success('Varsayılan referansa dönüldü.')
    },
  })
}

const schemaModalOpen = ref(false)

const sampleSchemaJson = computed(() => {
  const { source: _src, fetchedAt: _fetched, ...rest } = BUNDLED_BANKING_PRESET
  return JSON.stringify(rest, null, 2)
})

function openSchema(): void {
  schemaModalOpen.value = true
}

function closeSchema(): void {
  schemaModalOpen.value = false
}

async function copySchema(): Promise<void> {
  try {
    await navigator.clipboard.writeText(sampleSchemaJson.value)
    message.success('Örnek şema panoya kopyalandı.')
  } catch {
    message.error('Pano erişimi reddedildi.')
  }
}

function downloadSchema(): void {
  const blob = new Blob([sampleSchemaJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `banking-preset-ornek-${BUNDLED_BANKING_PRESET.id}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <Space direction="vertical" :size="16" style="width: 100%">
    <Alert
      v-if="!online"
      type="warning"
      show-icon
      message="Çevrimdışısınız"
      description="Uzaktan feed güncellemesi yalnızca çevrimiçiyken yapılabilir. Mevcut referans IndexedDB veya derlemeden okunmaya devam eder."
    />

    <Descriptions :column="1" size="small" bordered>
      <DescriptionsItem label="Etkin preset">
        {{ store.active.preset.label }}
      </DescriptionsItem>
      <DescriptionsItem label="Sürüm">
        {{ store.active.preset.id }} (şema v{{ store.active.preset.schemaVersion }})
      </DescriptionsItem>
      <DescriptionsItem label="Geçerlilik">
        {{ store.active.preset.effectiveFrom }}
      </DescriptionsItem>
      <DescriptionsItem label="Kaynak">
        <Tag :color="sourceTagColor">{{ sourceLabel }}</Tag>
      </DescriptionsItem>
      <DescriptionsItem label="Son güncelleme">
        {{ updatedAtText }}
      </DescriptionsItem>
    </Descriptions>

    <div>
      <Typography.Title :level="5" class="kp-section-title">Uzaktan güncelle</Typography.Title>
      <Typography.Paragraph class="kp-text-muted">
        Aşağıdaki adresten JSON formatında preset çekilir, Zod ile doğrulanır ve IndexedDB üzerine yazılır.
      </Typography.Paragraph>
      <Space.Compact style="width: 100%">
        <Input v-model:value="feedUrl" placeholder="https://.../tr-latest.json" />
        <Button
          type="primary"
          :loading="store.loading"
          :disabled="!online"
          @click="refreshFromFeed"
        >
          <template #icon><CloudDownloadOutlined /></template>
          Çek
        </Button>
      </Space.Compact>
    </div>

    <div>
      <Typography.Title :level="5" class="kp-section-title">Dosyadan içe aktar</Typography.Title>
      <Typography.Paragraph class="kp-text-muted">
        Elinizde bir JSON preset dosyası varsa şemaya uygunsa içe aktarılır.
        Beklenen alanları görmek için
        <a class="kp-inline-link" @click.prevent="openSchema">örnek şemayı</a>
        açabilirsiniz.
      </Typography.Paragraph>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        hidden
        @change="onFileSelected"
      />
      <Space :size="8" wrap>
        <Button :loading="importBusy" @click="chooseFile">
          <template #icon><UploadOutlined /></template>
          Dosya seç
        </Button>
        <Button @click="openSchema">
          <template #icon><FileTextOutlined /></template>
          Örnek şemayı göster
        </Button>
      </Space>
    </div>

    <div>
      <Typography.Title :level="5" class="kp-section-title">Varsayılana dön</Typography.Title>
      <Typography.Paragraph class="kp-text-muted">
        Önceki güncellemeyi geri alıp uygulamayla gelen varsayılan presete dönmek için kullanın.
      </Typography.Paragraph>
      <Button danger @click="confirmReset">
        <template #icon><ReloadOutlined /></template>
        Derleme varsayılanına dön
      </Button>
    </div>
  </Space>

  <Modal
    :open="schemaModalOpen"
    title="Örnek bankacılık preset şeması"
    :width="720"
    centered
    :footer="null"
    :mask-closable="true"
    @cancel="closeSchema"
  >
    <Typography.Paragraph class="kp-text-muted">
      Aşağıdaki JSON, uygulamanın beklediği alanları gösteren bir örnektir.
      Kendi dosyanızı hazırlarken aynı yapıyı koruyun; bilinmeyen alanlar
      yok sayılır, eksik alanlar Zod doğrulamasında hata verir.
    </Typography.Paragraph>

    <div class="kp-schema-actions">
      <KpTooltip title="Panoya kopyala">
        <Button size="small" @click="copySchema">
          <template #icon><CopyOutlined /></template>
          Kopyala
        </Button>
      </KpTooltip>
      <KpTooltip title="JSON dosyası olarak indir">
        <Button size="small" @click="downloadSchema">
          <template #icon><DownloadOutlined /></template>
          İndir
        </Button>
      </KpTooltip>
    </div>

    <JsonCodeBlock :code="sampleSchemaJson" max-height="min(50vh, 360px)" />

    <Alert
      type="info"
      show-icon
      class="kp-schema-hint"
      message="Alan açıklamaları"
      :description="undefined"
    >
      <template #description>
        <ul class="kp-schema-list">
          <li><code>schemaVersion</code>: şu an <strong>1</strong>; ileride uyumsuz değişiklik olursa artırılır.</li>
          <li><code>id</code> / <code>label</code> / <code>effectiveFrom</code>: presetin kimliği ve yürürlük tarihi.</li>
          <li><code>creditCard.maxRatesByBalanceTier</code>: BDDK üst sınırlarına göre bakiye dilimleri; son dilimin <code>maxBalance</code> değeri <code>null</code> olmalıdır.</li>
          <li><code>creditCard.minPaymentRate*</code>: 25.000 ₺ altı/üstü için asgari ödeme oranları (0–1 arası, ör. 0.20 = %20).</li>
          <li><code>cashAdvance</code>: nakit avans tavan oranları (opsiyonel).</li>
          <li><code>consumerLoan</code>: tüketici kredisi için ek vergi/açıklama alanları (opsiyonel).</li>
        </ul>
      </template>
    </Alert>
  </Modal>
</template>

<style scoped>
.kp-section-title {
  margin-top: 0 !important;
  margin-bottom: 4px !important;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
  margin-bottom: 8px;
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}

.kp-inline-link {
  color: var(--ant-color-link, #1677ff);
  cursor: pointer;
}

.kp-inline-link:hover {
  text-decoration: underline;
}

.kp-schema-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.kp-schema-hint {
  margin-top: 12px;
}

.kp-schema-hint :deep(.kp-schema-list) {
  margin: 0;
  padding-left: 18px;
}

.kp-schema-hint :deep(.kp-schema-list li) {
  margin-bottom: 4px;
}

.kp-schema-hint :deep(.kp-schema-list code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}

[data-theme='dark'] .kp-schema-hint :deep(.kp-schema-list code) {
  background: rgba(255, 255, 255, 0.08);
}
</style>
