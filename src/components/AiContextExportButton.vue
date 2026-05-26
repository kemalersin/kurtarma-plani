<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Button,
  Checkbox,
  Dropdown,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'ant-design-vue'
import { CopyOutlined, LoadingOutlined, RobotOutlined } from '@ant-design/icons-vue'
import KpTooltip from '@/components/KpTooltip.vue'
import {
  KP_MOBILE_VIEWPORT_MQ,
  useHoverCapable,
  useMatchMedia,
} from '@/composables/useMatchMedia'
import JsonCodeBlock from '@/components/JsonCodeBlock.vue'
import KpMarkdown from '@/components/KpMarkdown.vue'
import { useProfileStore } from '@/stores/profile'
import { EncryptedRepo } from '@/core/db/encrypted-repo'
import {
  buildAndFormatAiContext,
  type AiContextExportFormat,
} from '@/core/services/ai-context-export'
import { downloadTextFile, profileFileSlug } from '@/core/util/download'

const profileStore = useProfileStore()
const isMobileShell = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const isHoverCapable = useHoverCapable()

/** Dropdown tetikleyicisi doğrudan Button olmalı; Tooltip sarmalayıcı iPad/touch’ta menüyü açmaz. */
const isCompactTrigger = computed(
  () => isMobileShell.value || !isHoverCapable.value,
)

const menuOpen = ref(false)

const FORMAT_LABELS: Record<AiContextExportFormat, string> = {
  json: 'JSON',
  markdown: 'Markdown',
}

const FORMAT_MIME: Record<AiContextExportFormat, string> = {
  json: 'application/json;charset=utf-8',
  markdown: 'text/markdown;charset=utf-8',
}

const options = reactive({
  includeSensitive: false,
})

const loading = ref(false)
const copying = ref(false)
const previewOpen = ref(false)
const previewFormat = ref<AiContextExportFormat>('json')
const previewText = ref('')
const previewOmitted = ref({ archived: 0, sensitive: 0 })

const canExport = computed(
  () => profileStore.unlocked && Boolean(profileStore.activeProfile),
)

const previewTitle = computed(
  () => `AI dışa aktarım — ${FORMAT_LABELS[previewFormat.value]}`,
)

async function buildExportText(format: AiContextExportFormat): Promise<string | null> {
  const profile = profileStore.activeProfile
  const profileId = profileStore.activeProfileId
  if (!profile || !profileId || !profileStore.unlocked) {
    message.error('Dışa aktarmak için oturum açık bir profil gerekli.')
    return null
  }

  loading.value = true
  try {
    const repo = new EncryptedRepo(profileId, profileStore.encryptionKey)
    const rows = await repo.exportAllDecoded()
    const { document, text } = buildAndFormatAiContext(
      { profile, rows, includeSensitive: options.includeSensitive },
      format,
    )
    previewOmitted.value = {
      archived: document.omitted.archivedRecordCount,
      sensitive: document.omitted.sensitiveRecordCount,
    }
    if (
      document.omitted.archivedRecordCount > 0 ||
      document.omitted.sensitiveRecordCount > 0
    ) {
      const parts: string[] = []
      if (document.omitted.archivedRecordCount > 0) {
        parts.push(`${document.omitted.archivedRecordCount} arşiv kaydı hariç`)
      }
      if (document.omitted.sensitiveRecordCount > 0) {
        parts.push(`${document.omitted.sensitiveRecordCount} hassas kayıt hariç`)
      }
      message.info(parts.join('; ') + '.')
    }
    return text
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Dışa aktarım oluşturulamadı.')
    return null
  } finally {
    loading.value = false
  }
}

async function openPreview(format: AiContextExportFormat): Promise<void> {
  const text = await buildExportText(format)
  if (text == null) return
  previewFormat.value = format
  previewText.value = text
  previewOpen.value = true
}

async function copyPreview(): Promise<void> {
  if (!previewText.value) return
  copying.value = true
  try {
    await navigator.clipboard.writeText(previewText.value)
    message.success('Panoya kopyalandı.')
  } catch {
    message.error('Panoya kopyalanamadı.')
  } finally {
    copying.value = false
  }
}

function downloadFromPreview(): void {
  const profile = profileStore.activeProfile
  if (!profile || !previewText.value) return
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const slug = profileFileSlug(profile.name)
  const ext = previewFormat.value === 'markdown' ? 'md' : 'json'
  downloadTextFile(
    previewText.value,
    `kurtarma-plani-ai-${slug}-${stamp}.${ext}`,
    FORMAT_MIME[previewFormat.value],
  )
  message.success(`${FORMAT_LABELS[previewFormat.value]} indirildi.`)
  previewOpen.value = false
}

function selectFormat(format: AiContextExportFormat): void {
  menuOpen.value = false
  void openPreview(format)
}

</script>

<template>
  <Dropdown
    v-model:open="menuOpen"
    :disabled="!canExport || loading"
    :trigger="['click']"
    placement="bottomRight"
    :destroy-popup-on-hide="true"
  >
    <Button
      type="text"
      class="kp-ai-export-trigger"
      :class="{ 'kp-ai-export-trigger--compact': isCompactTrigger }"
      :disabled="!canExport"
      :aria-label="'AI analizi için veri dışa aktar'"
      :title="isHoverCapable ? 'AI analizi için veri dışa aktar' : undefined"
    >
      <template #icon>
        <LoadingOutlined v-if="loading" spin />
        <RobotOutlined v-else />
      </template>
      <span v-if="!isCompactTrigger" class="kp-ai-export-trigger__label">AI dışa aktar</span>
    </Button>
    <template #overlay>
      <Menu>
        <MenuItem key="json" @click="selectFormat('json')">
          <span class="kp-ai-export-menu-row">
            <span class="kp-ai-export-menu-row__label">
              <Tag color="geekblue" class="kp-ai-export-menu-tag">JSON</Tag>
            </span>
            <span class="kp-ai-export-menu-row__suffix">Önizle ve indir</span>
          </span>
        </MenuItem>
        <MenuItem key="markdown" @click="selectFormat('markdown')">
          <span class="kp-ai-export-menu-row">
            <span class="kp-ai-export-menu-row__label">
              <Tag color="purple" class="kp-ai-export-menu-tag">Markdown</Tag>
            </span>
            <span class="kp-ai-export-menu-row__suffix">Önizle ve indir</span>
          </span>
        </MenuItem>
        <MenuDivider />
        <MenuItem disabled class="kp-ai-export-menu-options">
          <Checkbox
            v-model:checked="options.includeSensitive"
            @click.stop
          >
            Hassas kayıtları dahil et
          </Checkbox>
        </MenuItem>
      </Menu>
    </template>
  </Dropdown>

  <Modal
    v-model:open="previewOpen"
    :title="previewTitle"
    centered
    width="min(920px, calc(100vw - 32px))"
    :destroy-on-close="true"
  >
    <Typography.Paragraph type="secondary" class="kp-ai-export-preview-hint">
      Bu dosya yedek değildir; ChatGPT, Claude Code vb. araçlara bağlam olarak
      yapıştırılabilir. API anahtarları ve sohbet geçmişi dahil edilmez.
      Yapılandırılmış dosyada yalnızca ödenmemiş taksitler listelenir; kalan borç gecikme
      faizi dahildir.
      <span v-if="previewOmitted.archived || previewOmitted.sensitive">
        ({{ previewOmitted.archived }} arşiv,
        {{ previewOmitted.sensitive }} hassas kayıt hariç tutuldu.)
      </span>
    </Typography.Paragraph>

    <div class="kp-ai-export-preview-toolbar">
      <KpTooltip title="Panoya kopyala">
        <Button size="small" :loading="copying" @click="copyPreview">
          <template #icon><CopyOutlined /></template>
          Kopyala
        </Button>
      </KpTooltip>
    </div>

    <JsonCodeBlock
      v-if="previewFormat === 'json'"
      :code="previewText"
      max-height="min(60vh, 480px)"
    />
    <div
      v-else
      class="kp-ai-export-markdown-wrap"
    >
      <KpMarkdown :source="previewText" />
    </div>

    <template #footer>
      <Space>
        <Button @click="previewOpen = false">Kapat</Button>
        <Button type="primary" @click="downloadFromPreview">
          İndir ({{ FORMAT_LABELS[previewFormat] }})
        </Button>
      </Space>
    </template>
  </Modal>
</template>

<style scoped>
.kp-ai-export-preview-hint {
  margin-bottom: 8px;
}

.kp-ai-export-preview-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.kp-ai-export-markdown-wrap {
  max-height: min(60vh, 480px);
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.02);
}

[data-theme='dark'] .kp-ai-export-markdown-wrap {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.kp-ai-export-trigger__label {
  font-size: 13px;
}

.kp-ai-export-trigger {
  touch-action: manipulation;
}

.kp-ai-export-trigger--compact.ant-btn {
  width: auto;
  height: auto;
  min-width: 0;
  padding: 4px 8px;
  line-height: 1;
}

.kp-ai-export-trigger--compact :deep(.anticon) {
  font-size: 16px;
}

.kp-ai-export-menu-row {
  display: grid;
  /* Markdown etiketi en geniş; sonekler aynı dikey hizada başlar */
  grid-template-columns: 5.75rem auto;
  align-items: center;
  column-gap: 8px;
}

.kp-ai-export-menu-row__label {
  display: flex;
  align-items: center;
}

.kp-ai-export-menu-tag {
  margin: 0;
}

.kp-ai-export-menu-row__suffix {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  white-space: nowrap;
}

[data-theme='dark'] .kp-ai-export-menu-row__suffix {
  color: rgba(255, 255, 255, 0.45);
}

:deep(.kp-ai-export-menu-options) {
  cursor: default;
  opacity: 1 !important;
  color: inherit !important;
}
</style>
