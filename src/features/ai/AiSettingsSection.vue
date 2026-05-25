<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Divider,
  Form,
  FormItem,
  Input,
  InputPassword,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'ant-design-vue'
import { CloudDownloadOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useAiStore } from '@/stores/ai'
import { useModelsCatalogStore } from '@/stores/models-catalog'
import { isCloudCatalogProvider } from '@/core/types/ai-catalog'
import type { AiProviderConfig, AiProviderId } from '@/core/types/ai-settings'
import { DEFAULT_BASE_URLS, fetchOllamaModels, fetchVllmModels } from '@/features/ai/providers'
import {
  usesDevAiProxy,
} from '@/features/ai/providers/proxy-url'
import { formatCostUsd } from '@/features/ai/cost'
import { normalizeApiKey } from '@/features/ai/provider-auth'
import { useConnectivity } from '@/composables/useConnectivity'
import KpTooltip from '@/components/KpTooltip.vue'
import { TABLE_SCROLL_X } from '@/core/util/table-columns'
import { useProfileStore } from '@/stores/profile'

const ai = useAiStore()
const catalogStore = useModelsCatalogStore()
const profileStore = useProfileStore()
const { online } = useConnectivity()

const isDev = import.meta.env.DEV

const hasCloudProvider = computed(() =>
  (ai.settings?.providers ?? []).some((p) =>
    ['anthropic', 'openai', 'gemini', 'deepseek'].includes(p.provider),
  ),
)

const providerTypeOptions = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'ollama', label: 'Ollama (yerel)' },
  { value: 'vllm', label: 'vLLM (yerel)' },
]

const drawerOpen = ref(false)
const draft = ref<AiProviderConfig | null>(null)
const apiKeyDraft = ref('')
const editingExisting = ref(false)
const remoteModels = ref<{ value: string; label: string }[]>([])
const loadingRemote = ref(false)
const saving = ref(false)
const addProviderType = ref<AiProviderId | undefined>()
const pageLoading = ref(true)
const customPromptDraft = ref('')
const savingCustomPrompt = ref(false)

function syncCustomPromptDraft(): void {
  customPromptDraft.value = ai.settings?.customSystemPrompt ?? ''
}

async function ensureLoaded(): Promise<void> {
  pageLoading.value = true
  try {
    await Promise.all([catalogStore.load(), ai.load()])
    syncCustomPromptDraft()
  } finally {
    pageLoading.value = false
  }
}

async function saveCustomPrompt(): Promise<void> {
  if (!ai.settings) return
  savingCustomPrompt.value = true
  try {
    const trimmed = customPromptDraft.value.trim()
    await ai.saveSettings({
      ...ai.settings,
      customSystemPrompt: trimmed || undefined,
    })
    syncCustomPromptDraft()
    message.success('Sistem prompt eklentisi kaydedildi.')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  } finally {
    savingCustomPrompt.value = false
  }
}

function clearCustomPrompt(): void {
  customPromptDraft.value = ''
}

onMounted(() => void ensureLoaded())

watch(
  () => profileStore.activeProfileId,
  (id, prev) => {
    if (id && id !== prev) void ensureLoaded()
  },
)

const catalogUpdatedText = computed(() => {
  const value = catalogStore.active.updatedAt ?? catalogStore.active.catalog.fetchedAt
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
})

const catalogSourceLabel = computed(() =>
  catalogStore.active.source === 'remote' ? 'IndexedDB (models.dev)' : 'Derleme gömülü',
)

const catalogSourceColor = computed(() =>
  catalogStore.active.source === 'remote' ? 'blue' : 'default',
)

const catalogModelCount = computed(() => {
  let n = 0
  for (const block of Object.values(catalogStore.active.catalog.providers)) {
    n += Object.keys(block.models).length
  }
  return n
})

const usageColumns = [
  { title: 'Tarih', dataIndex: 'at', key: 'at' },
  { title: 'Model', dataIndex: 'modelId', key: 'modelId' },
  { title: 'Girdi', dataIndex: 'inputTokens', key: 'inputTokens' },
  { title: 'Çıktı', dataIndex: 'outputTokens', key: 'outputTokens' },
  { title: 'Maliyet', dataIndex: 'costUsd', key: 'costUsd' },
]

const usageRows = computed(() =>
  ai.usageEntries.map((e) => ({
    key: e.id,
    at: new Date(e.at).toLocaleString('tr-TR'),
    modelId: e.modelId,
    inputTokens: e.inputTokens,
    outputTokens: e.outputTokens,
    costUsd: formatCostUsd(e.costUsd),
  })),
)

const modelSelectOptions = computed(() => {
  if (!draft.value) return remoteModels.value
  if (isCloudCatalogProvider(draft.value.provider)) {
    return catalogStore.listModelOptions(draft.value.provider)
  }
  return remoteModels.value
})

watch(
  () => draft.value?.provider,
  () => {
    remoteModels.value = []
  },
)

function onAddProvider(type: AiProviderId): void {
  openNew(type)
  addProviderType.value = undefined
}

function openNew(provider: AiProviderId): void {
  editingExisting.value = false
  apiKeyDraft.value = ''
  draft.value = {
    ...ai.newProviderDraft(provider),
  }
  drawerOpen.value = true
}

function openEdit(row: AiProviderConfig): void {
  editingExisting.value = true
  apiKeyDraft.value = ''
  draft.value = { ...row, apiKey: undefined }
  drawerOpen.value = true
}

async function saveDraft(): Promise<void> {
  if (!draft.value) return
  if (!draft.value.label.trim()) {
    message.error('Etiket boş olamaz.')
    return
  }
  const existing = ai.settings?.providers.find((p) => p.id === draft.value!.id)
  const apiKeyRaw = apiKeyDraft.value.trim() ? apiKeyDraft.value : existing?.apiKey
  const apiKey = apiKeyRaw != null ? normalizeApiKey(apiKeyRaw) : undefined
  saving.value = true
  try {
    await ai.upsertProvider({
      ...draft.value,
      label: draft.value.label.trim(),
      apiKey,
    })
    message.success('Sağlayıcı kaydedildi.')
    drawerOpen.value = false
    draft.value = null
    apiKeyDraft.value = ''
    editingExisting.value = false
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  } finally {
    saving.value = false
  }
}

async function loadRemoteModels(): Promise<void> {
  if (!draft.value) return
  loadingRemote.value = true
  try {
    if (draft.value.provider === 'ollama') {
      const list = await fetchOllamaModels(draft.value.baseUrl ?? DEFAULT_BASE_URLS.ollama)
      remoteModels.value = list.map((m) => ({ value: m.id, label: m.name }))
    } else if (draft.value.provider === 'vllm') {
      const list = await fetchVllmModels(
        draft.value.baseUrl ?? DEFAULT_BASE_URLS.vllm,
        draft.value.apiKey,
      )
      remoteModels.value = list.map((m) => ({ value: m.id, label: m.name }))
    }
    if (remoteModels.value.length === 0) message.warning('Model bulunamadı.')
    else message.success(`${remoteModels.value.length} model yüklendi.`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Model listesi alınamadı.')
  } finally {
    loadingRemote.value = false
  }
}

async function refreshCatalog(): Promise<void> {
  if (!online.value) {
    message.warning('Çevrimdışısınız; model kataloğu güncellenemiyor.')
    return
  }
  const ok = await catalogStore.refreshFromRemote()
  if (ok) message.success('Model kataloğu güncellendi.')
  else message.error(catalogStore.lastError ?? 'Güncelleme başarısız.')
}

async function resetCatalog(): Promise<void> {
  await catalogStore.resetToEmbedded()
  message.success('Gömülü katalog kullanılıyor.')
}
</script>

<template>
  <div v-if="pageLoading" class="kp-page-spinner">
    <Spin size="large" />
  </div>

  <div v-else class="kp-ai-settings">
    <Typography.Paragraph class="kp-text-muted">
      API anahtarları yalnızca tarayıcınızda saklanır; AI sistem promptuna ve dışa aktarıma
      (varsayılan) dahil edilmez. Model listesi ve birim fiyatlar
      <Typography.Text code>models.dev</Typography.Text> kaynağından gelir; IndexedDB'de kayıt
      varsa derleme gömülü listeyi ezer.
    </Typography.Paragraph>

    <Card title="Model kataloğu" size="small" class="kp-ai-settings__card">
      <Descriptions size="small" :column="1" bordered>
        <DescriptionsItem label="Kaynak">
          <Tag :color="catalogSourceColor">{{ catalogSourceLabel }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="Son güncelleme">{{ catalogUpdatedText }}</DescriptionsItem>
        <DescriptionsItem label="Model sayısı">{{ catalogModelCount }}</DescriptionsItem>
      </Descriptions>
      <Space wrap class="kp-ai-settings__catalog-actions">
        <KpTooltip title="models.dev'den güncel model listesini çeker ve IndexedDB'ye yazar">
          <Button
            type="primary"
            :loading="catalogStore.loading"
            :disabled="!online"
            @click="refreshCatalog"
          >
            <CloudDownloadOutlined />
            Kataloğu güncelle
          </Button>
        </KpTooltip>
        <Popconfirm
          v-if="catalogStore.active.source === 'remote'"
          title="Gömülü kataloga dönülsün mü? IndexedDB kaydı silinir."
          ok-text="Sıfırla"
          cancel-text="Vazgeç"
          @confirm="resetCatalog"
        >
          <Button :loading="catalogStore.loading">
            <ReloadOutlined />
            Gömülüye sıfırla
          </Button>
        </Popconfirm>
      </Space>
      <Alert
        v-if="!online"
        type="warning"
        show-icon
        message="Çevrimdışı"
        description="Katalog güncellemesi yalnızca çevrimiçiyken yapılabilir."
        class="kp-ai-settings__alert-inline"
      />
    </Card>

    <Alert
      v-if="isDev && hasCloudProvider"
      type="info"
      show-icon
      message="Geliştirme proxy'si aktif"
      description="Bulut API istekleri otomatik olarak yerel Vite proxy (/kp-ai-proxy) üzerinden gider; CORS engeli oluşmaz."
      class="kp-ai-settings__alert"
    />

    <Alert
      v-if="!ai.settings?.providers.length"
      type="info"
      show-icon
      message="Henüz AI sağlayıcısı tanımlı değil."
      description="Aşağıdan bir sağlayıcı ekleyin; ardından AI sohbet sayfasını kullanabilirsiniz."
      class="kp-ai-settings__alert"
    />

    <Card title="Sağlayıcılar" size="small" class="kp-ai-settings__card">
      <Space wrap class="kp-ai-settings__add">
        <Select
          v-model:value="addProviderType"
          placeholder="Yeni sağlayıcı türü"
          :options="providerTypeOptions"
          style="min-width: 200px"
          allow-clear
          @change="(v) => { if (typeof v === 'string') onAddProvider(v as AiProviderId) }"
        />
      </Space>

      <Divider v-if="ai.settings?.providers.length" class="kp-ai-settings__providers-divider" />

      <ul v-if="ai.settings?.providers.length" class="kp-ai-settings__list">
        <li
          v-for="p in ai.settings.providers"
          :key="p.id"
          class="kp-ai-settings__item"
          :class="{ 'kp-ai-settings__item--last-used': p.id === ai.lastUsedProviderId }"
        >
          <div>
            <Space :size="6" wrap class="kp-ai-settings__item-title">
              <strong>{{ p.label }}</strong>
              <Tag v-if="p.id === ai.lastUsedProviderId" color="blue">Son kullanılan</Tag>
            </Space>
            <Typography.Text type="secondary" class="kp-ai-settings__meta">
              {{ p.provider }} · {{ p.defaultModelId || 'model seçilmedi' }}
            </Typography.Text>
          </div>
          <Space>
            <Button size="small" @click="openEdit(p)">Düzenle</Button>
            <Popconfirm title="Bu sağlayıcı silinsin mi?" @confirm="ai.removeProvider(p.id)">
              <Button size="small" danger ghost>Sil</Button>
            </Popconfirm>
          </Space>
        </li>
      </ul>
    </Card>

    <Card title="Sistem prompt eklentisi" size="small" class="kp-ai-settings__card">
      <Typography.Paragraph class="kp-text-muted kp-ai-settings__prompt-desc">
        Varsayılan asistan talimatlarına eklenecek metin. Her sohbet mesajında sistem
        promptunun sonuna eklenir; finans JSON snapshot'ı değişmez.
      </Typography.Paragraph>
      <Form layout="vertical" :colon="false" class="kp-ai-settings__prompt-form">
        <FormItem label="Ek talimatlar">
          <Input.TextArea
            v-model:value="customPromptDraft"
            :auto-size="{ minRows: 4, maxRows: 12 }"
            placeholder="Örn: Yanıtları madde madde ver. Kredi kartı borcuna öncelik ver."
            :maxlength="4000"
            show-count
          />
        </FormItem>
      </Form>
      <Space wrap class="kp-ai-settings__prompt-actions">
        <Button type="primary" :loading="savingCustomPrompt" @click="saveCustomPrompt">
          Kaydet
        </Button>
        <Button :disabled="!customPromptDraft" @click="clearCustomPrompt">Temizle</Button>
      </Space>
    </Card>

    <Card title="Kullanım geçmişi" size="small" class="kp-ai-settings__card kp-ai-settings__card--last">
      <Typography.Paragraph class="kp-text-muted">
        Sohbet temizlenince ilgili oturum kayıtları silinir. Toplam (tüm oturumlar):
        {{ formatCostUsd(ai.totalUsageCost) }}
      </Typography.Paragraph>
      <Table
        :columns="usageColumns"
        :data-source="usageRows"
        :pagination="{ pageSize: 5, hideOnSinglePage: true }"
        size="small"
        table-layout="auto"
        :scroll="{ x: TABLE_SCROLL_X }"
        :show-sorter-tooltip="false"
        :locale="{ emptyText: 'Henüz kullanım kaydı yok.' }"
      />
    </Card>
  </div>

  <Modal
    v-model:open="drawerOpen"
    :title="draft?.label ? `Sağlayıcı: ${draft.label}` : 'Sağlayıcı'"
    ok-text="Kaydet"
    cancel-text="Vazgeç"
    :confirm-loading="saving"
    :body-style="{ paddingBottom: '8px' }"
    @ok="saveDraft"
    @cancel="drawerOpen = false"
  >
    <Form v-if="draft" layout="vertical" :colon="false" class="kp-ai-settings__modal-form">
      <FormItem label="Etiket" required>
        <Input v-model:value="draft.label" />
      </FormItem>
      <FormItem
        v-if="draft.provider !== 'ollama' && draft.provider !== 'vllm'"
        label="API anahtarı"
        required
      >
        <InputPassword
          v-model:value="apiKeyDraft"
          autocomplete="off"
          :placeholder="
            editingExisting
              ? 'Değiştirmek için yeni anahtar girin (boş bırakılırsa mevcut korunur)'
              : 'sk-…'
          "
        />
      </FormItem>
      <FormItem v-else label="API anahtarı (opsiyonel)">
        <InputPassword v-model:value="apiKeyDraft" autocomplete="off" />
      </FormItem>
      <FormItem label="Base URL">
        <Input
          v-model:value="draft.baseUrl"
          :placeholder="DEFAULT_BASE_URLS[draft.provider]"
        />
        <Typography.Paragraph
          v-if="usesDevAiProxy(draft.provider)"
          type="secondary"
          class="kp-ai-settings__field-hint"
        >
          Boş bırakılırsa geliştirmede otomatik proxy kullanılır.
        </Typography.Paragraph>
      </FormItem>
      <FormItem label="Varsayılan model" required>
        <Space direction="vertical" style="width: 100%">
          <Select
            v-model:value="draft.defaultModelId"
            show-search
            :options="modelSelectOptions"
            placeholder="Model seçin"
            :filter-option="(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())"
          />
          <Button
            v-if="draft.provider === 'ollama' || draft.provider === 'vllm'"
            :loading="loadingRemote"
            @click="loadRemoteModels"
          >
            Uzak model listesini yükle
          </Button>
        </Space>
      </FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.kp-ai-settings__alert {
  margin-bottom: 16px;
}

.kp-ai-settings__alert-inline {
  margin-top: 12px;
}

.kp-ai-settings__field-hint {
  margin: 6px 0 0;
  font-size: 12px;
}

.kp-ai-settings__catalog-actions {
  margin-top: 12px;
}

@media (max-width: 768px) {
  .kp-ai-settings__catalog-actions.ant-space {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 8px !important;
  }

  .kp-ai-settings__catalog-actions > :deep(.ant-space-item) {
    width: 100%;
    max-width: 100%;
    margin: 0 !important;
  }

  .kp-ai-settings__catalog-actions > :deep(.ant-space-item) > * {
    display: block;
    width: 100%;
  }

  .kp-ai-settings__catalog-actions :deep(.ant-btn) {
    width: 100%;
  }
}

.kp-ai-settings__prompt-desc {
  margin-bottom: 12px;
}

.kp-ai-settings__prompt-form :deep(.ant-form-item:last-child) {
  margin-bottom: 8px;
}

.kp-ai-settings__prompt-actions {
  margin-top: 0;
}

.kp-ai-settings__modal-form :deep(.ant-form-item:last-child) {
  margin-bottom: 0;
}

.kp-ai-settings__card {
  margin-bottom: 16px;
}

.kp-ai-settings__card--last {
  margin-bottom: 0;
}

.kp-ai-settings__add {
  margin-bottom: 0;
}

.kp-ai-settings__providers-divider {
  margin: 12px 0;
}

.kp-ai-settings__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.kp-ai-settings__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
}

.kp-ai-settings__item:last-child {
  border-bottom: 0;
}

.kp-ai-settings__item--last-used {
  padding-left: 8px;
  margin-left: -8px;
  border-left: 3px solid var(--ant-color-primary, #1677ff);
}

.kp-ai-settings__item-title {
  margin-bottom: 2px;
}

.kp-ai-settings__meta {
  display: block;
  font-size: 12px;
}
</style>
