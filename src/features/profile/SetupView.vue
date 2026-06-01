<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Card,
  Form,
  FormItem,
  Input,
  InputPassword,
  Button,
  Switch,
  Checkbox,
  Alert,
  Typography,
  Tabs,
  TabPane,
  message,
} from 'ant-design-vue'
import { ExperimentOutlined } from '@ant-design/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import type { LocaleSettings } from '@/core/types/profile'
import LocaleSettingsForm from '@/components/LocaleSettingsForm.vue'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import ProfileRestorePanel from '@/components/ProfileRestorePanel.vue'
import ProfileRestoreEsrSection from '@/components/ProfileRestoreEsrSection.vue'
import SyncConflictModal from '@/components/SyncConflictModal.vue'
import SyncRecoveryPhraseModal from '@/components/SyncRecoveryPhraseModal.vue'
import type { ProfileRestoreKind, ProfileRestoreOutcome } from '@/core/services/profile-restore'
import { APP_NAME } from '@/core/constants'

type SetupTab = 'new' | 'restore' | 'senkronla'

function parseSetupTab(tab: unknown): SetupTab {
  if (tab === 'restore' || tab === 'senkronla') return tab
  return 'new'
}

const profileStore = useProfileStore()
const router = useRouter()
const route = useRoute()
const submitting = ref(false)
const restoreReadyProfileId = ref<string | null>(null)
/** Kuruluma girildiğinde zaten profil vardı (seçim ekranından); ilk kurulumda false kalır. */
const showBackToSelect = ref(false)

onMounted(() => {
  showBackToSelect.value = profileStore.profiles.length > 0
})

const activeTab = ref<SetupTab>(parseSetupTab(route.query.tab))

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = parseSetupTab(tab)
  },
)

const form = reactive<{
  name: string
  usePassword: boolean
  password: string
  passwordConfirm: string
  withSampleData: boolean
  locale: LocaleSettings
}>({
  name: 'Varsayılan',
  usePassword: false,
  password: '',
  passwordConfirm: '',
  withSampleData: false,
  locale: { ...DEFAULT_LOCALE_SETTINGS },
})

async function openImportedProfile(profileId: string, password?: string): Promise<boolean> {
  await profileStore.load()
  const ok = await profileStore.selectProfile(profileId, password)
  if (!ok) return false
  const { useSyncStore } = await import('@/stores/sync')
  const syncStore = useSyncStore()
  if (!syncStore.loaded) await syncStore.load()
  await syncStore.onActiveProfileChanged()
  return true
}

async function openRestoredProfile(profileId: string, password?: string): Promise<boolean> {
  return openImportedProfile(profileId, password)
}

async function onRestored(
  outcome: ProfileRestoreOutcome,
  kind: ProfileRestoreKind,
  unlockPassword?: string,
): Promise<void> {
  const profileId = outcome.summary.targetProfileId
  if (!profileId) {
    message.error('Profil kimliği alınamadı.')
    return
  }
  submitting.value = true
  try {
    const ok = await openRestoredProfile(profileId, unlockPassword)
    if (ok) {
      restoreReadyProfileId.value = null
      message.success(
        kind === 'backup' ? 'Yedek içe aktarıldı.' : 'Profil geri yüklendi.',
      )
      await router.push({ name: 'home' })
    } else {
      restoreReadyProfileId.value = profileId
      message.warning('Profil içe aktarıldı; profil seçim ekranından açmayı deneyin.')
      await router.push({ name: 'select' })
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Profil açılamadı.')
  } finally {
    submitting.value = false
  }
}

async function onRelayJoined(profileId: string): Promise<void> {
  submitting.value = true
  try {
    const ok = await openRestoredProfile(profileId)
    if (ok) {
      message.success('Senkronla\'ya eklendi; veriler senkronize edildi.')
      await router.push({ name: 'home' })
    } else {
      message.warning('Senkron tamamlandı; profili seçim ekranından açmayı deneyin.')
      await router.push({ name: 'select' })
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Profil açılamadı.')
  } finally {
    submitting.value = false
  }
}

async function continueToApp(): Promise<void> {
  if (!restoreReadyProfileId.value) return
  submitting.value = true
  try {
    await router.push({ name: 'home' })
  } finally {
    submitting.value = false
  }
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    message.error('Profil adı boş olamaz.')
    return
  }
  if (form.usePassword) {
    if (form.password.length < 6) {
      message.error('Parola en az 6 karakter olmalıdır.')
      return
    }
    if (form.password !== form.passwordConfirm) {
      message.error('Parolalar eşleşmiyor.')
      return
    }
  }

  submitting.value = true
  try {
    const profile = await profileStore.createProfile({
      name: form.name,
      localeSettings: form.locale,
      password: form.usePassword ? form.password : undefined,
    })
    const ok = await profileStore.selectProfile(profile.id, form.usePassword ? form.password : undefined)
    if (ok) {
      const { useSyncStore } = await import('@/stores/sync')
      const syncStore = useSyncStore()
      if (!syncStore.loaded) await syncStore.load()
      await syncStore.prepareNewProfileSync(profile.id)
      if (!form.usePassword) {
        await syncStore.saveConfig({ encryptFile: false, useProfilePassword: false })
      }
      if (form.withSampleData) {
        const count = await profileStore.seedActiveProfileSampleData()
        message.success(`Profil oluşturuldu: ${profile.name} (${count} örnek kayıt)`)
      } else {
        message.success(`Profil oluşturuldu: ${profile.name}`)
      }
      await router.push({ name: 'home' })
    } else {
      message.error('Profil oluşturuldu fakat açılamadı.')
    }
  } catch (error) {
    console.error(error)
    message.error('Profil oluşturulamadı.')
  } finally {
    submitting.value = false
  }
}

function goSelect(): void {
  if (profileStore.hasAnyProfile) {
    void router.push({ name: 'select' })
  }
}
</script>

<template>
  <div class="kp-center-page">
    <Card class="kp-card" :title="`${APP_NAME} · Kurulum`">
      <Typography.Paragraph class="kp-text-muted">
        Yeni profil oluşturabilir, yedek veya senkron dosyası ile geri yükleyebilir veya
        «Senkronla» sekmesinden host cihaza eşleştirerek profili ve veriyi otomatik alabilirsiniz.
      </Typography.Paragraph>

      <AppDisclaimer :show-inline="true" />

      <Tabs v-model:active-key="activeTab" class="kp-setup-tabs">
        <TabPane key="new" tab="Yeni profil">
          <Form layout="vertical" :colon="false" style="margin-top: 8px" @submit.prevent="submit">
            <FormItem label="Profil adı" required>
              <Input v-model:value="form.name" placeholder="Örn. Kişisel, Aile, İşletme…" />
            </FormItem>

            <label
              class="kp-setup-sample"
              :class="{ 'kp-setup-sample--active': form.withSampleData }"
            >
              <Checkbox v-model:checked="form.withSampleData" class="kp-setup-sample__check" />
              <span class="kp-setup-sample__body">
                <span class="kp-setup-sample__title">
                  <ExperimentOutlined class="kp-setup-sample__icon" aria-hidden="true" />
                  Örnek verilerle doldur
                </span>
                <span class="kp-setup-sample__desc">
                  Bankalar, hesaplar, kredi, kredi kartı, nakit avans ve gelir/gider kayıtları
                  eklenir — uygulamayı hızlıca keşfetmek için ideal.
                </span>
              </span>
            </label>

            <Typography.Title :level="5" style="margin-top: 16px">Bölgesel ayarlar</Typography.Title>
            <LocaleSettingsForm v-model="form.locale" />

            <Typography.Title :level="5" style="margin-top: 8px">Güvenlik</Typography.Title>
            <FormItem>
              <Switch v-model:checked="form.usePassword" /> &nbsp;
              <span class="kp-text-muted">Bu profil için parola ayarla (isteğe bağlı)</span>
            </FormItem>

            <template v-if="form.usePassword">
              <FormItem label="Parola" required>
                <InputPassword v-model:value="form.password" placeholder="En az 6 karakter" />
              </FormItem>
              <FormItem label="Parola (tekrar)" required>
                <InputPassword v-model:value="form.passwordConfirm" />
              </FormItem>
              <Alert
                type="info"
                show-icon
                message="Parolayı kaybederseniz veriler çözülemez."
                description="Parolayı güvenli bir yerde saklayın. Uygulama parolayı sunucuya göndermez ve geri kazanamaz."
              />
            </template>

            <FormItem style="margin-top: 16px">
              <Button type="primary" html-type="submit" :loading="submitting" block>
                Profili oluştur ve aç
              </Button>
            </FormItem>
          </Form>
        </TabPane>

        <TabPane key="restore" tab="Yedekten geri yükle">
          <ProfileRestorePanel @restored="onRestored" />
          <Button
            v-if="restoreReadyProfileId"
            type="primary"
            block
            class="kp-setup-continue"
            :loading="submitting"
            @click="continueToApp"
          >
            Uygulamaya geç
          </Button>
        </TabPane>

        <TabPane key="senkronla" tab="Senkron.la">
          <ProfileRestoreEsrSection @joined="onRelayJoined" />
        </TabPane>
      </Tabs>

      <SyncConflictModal />
      <SyncRecoveryPhraseModal />

      <Button
        v-if="showBackToSelect"
        type="link"
        class="kp-setup-back"
        @click="goSelect"
      >
        Profil seçimine dön
      </Button>
    </Card>
  </div>
</template>

<style scoped>
.kp-setup-tabs {
  margin-top: 12px;
}

.kp-setup-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}

.kp-setup-back {
  margin-top: 8px;
  padding-left: 0;
}

.kp-setup-continue {
  margin-top: 16px;
}

.kp-setup-sample {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 4px 0 20px;
  padding: 14px 16px;
  border: 2px solid rgba(22, 119, 255, 0.28);
  border-radius: var(--kp-radius, 8px);
  background: rgba(22, 119, 255, 0.06);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.kp-setup-sample:hover {
  border-color: rgba(22, 119, 255, 0.45);
  background: rgba(22, 119, 255, 0.1);
}

.kp-setup-sample--active {
  border-color: #1677ff;
  background: rgba(22, 119, 255, 0.14);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
}

.kp-setup-sample__check {
  flex-shrink: 0;
  margin-top: 2px;
}

.kp-setup-sample__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.kp-setup-sample__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.88);
}

.kp-setup-sample__icon {
  font-size: 18px;
  color: #1677ff;
}

.kp-setup-sample__desc {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-setup-sample {
  border-color: rgba(64, 150, 255, 0.35);
  background: rgba(22, 119, 255, 0.12);
}

[data-theme='dark'] .kp-setup-sample:hover {
  border-color: rgba(64, 150, 255, 0.55);
  background: rgba(22, 119, 255, 0.18);
}

[data-theme='dark'] .kp-setup-sample--active {
  border-color: #4096ff;
  background: rgba(22, 119, 255, 0.22);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.18);
}

[data-theme='dark'] .kp-setup-sample__title {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-setup-sample__icon {
  color: #4096ff;
}

[data-theme='dark'] .kp-setup-sample__desc {
  color: rgba(255, 255, 255, 0.55);
}
</style>
