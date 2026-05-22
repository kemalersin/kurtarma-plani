<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoutedTabs } from '@/composables/useRoutedTabs'
import {
  Card,
  Typography,
  Space,
  Button,
  message,
  Form,
  FormItem,
  Input,
  Tabs,
  TabPane,
} from 'ant-design-vue'
import LocaleSettingsForm from '@/components/LocaleSettingsForm.vue'
import PasswordSection from '@/components/PasswordSection.vue'
import PageHeader from '@/components/PageHeader.vue'
import BankingPresetSection from '@/components/BankingPresetSection.vue'
import DataBackupSection from '@/components/DataBackupSection.vue'
import { useProfileStore } from '@/stores/profile'
import { saveProfile } from '@/core/db/meta'
import type { LocaleSettings, ProfileMeta } from '@/core/types/profile'

const profileStore = useProfileStore()
const profile = computed<ProfileMeta | null>(() => profileStore.activeProfile)

const localeDraft = ref<LocaleSettings>({
  locale: 'tr-TR',
  currency: 'TRY',
  timeZone: 'Europe/Istanbul',
  dateFormat: 'dd.MM.yyyy',
})
const nameDraft = ref('')
const savingName = ref(false)
const savingLocale = ref(false)
const SETTINGS_TABS = ['profile', 'locale', 'security', 'banking', 'data'] as const
const { activeTab } = useRoutedTabs(SETTINGS_TABS, 'profile')

watch(
  profile,
  (next) => {
    if (next) {
      localeDraft.value = { ...next.localeSettings }
      nameDraft.value = next.name
    }
  },
  { immediate: true },
)

async function saveName(): Promise<void> {
  if (!profile.value) return
  if (!nameDraft.value.trim()) {
    message.error('Profil adı boş olamaz.')
    return
  }
  savingName.value = true
  try {
    const updated: ProfileMeta = {
      ...profile.value,
      name: nameDraft.value.trim(),
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(updated)
    await profileStore.load()
    message.success('Profil adı kaydedildi.')
  } catch (error) {
    console.error(error)
    message.error('Kaydedilemedi.')
  } finally {
    savingName.value = false
  }
}

async function saveLocale(): Promise<void> {
  if (!profile.value) return
  savingLocale.value = true
  try {
    const updated: ProfileMeta = {
      ...profile.value,
      localeSettings: { ...localeDraft.value },
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(updated)
    await profileStore.load()
    message.success('Bölgesel ayarlar kaydedildi.')
  } catch (error) {
    console.error(error)
    message.error('Kaydedilemedi.')
  } finally {
    savingLocale.value = false
  }
}
</script>

<template>
  <div class="kp-settings">
    <PageHeader
      title="Ayarlar"
      subtitle="Profil bilgileri, bölgesel biçimler ve güvenlik tercihleri."
    />

    <Tabs v-model:activeKey="activeTab" type="line">
      <TabPane key="profile" tab="Profil">
        <Card title="Profil bilgileri">
          <Form layout="vertical" :colon="false">
            <FormItem label="Profil adı" required>
              <Input v-model:value="nameDraft" />
            </FormItem>
          </Form>
          <Space>
            <Button type="primary" :loading="savingName" @click="saveName">Kaydet</Button>
          </Space>
        </Card>
      </TabPane>

      <TabPane key="locale" tab="Bölgesel">
        <Card title="Bölgesel ayarlar">
          <Typography.Paragraph class="kp-text-muted">
            Bu profil için tutar, tarih ve saat dilimi biçimleri.
          </Typography.Paragraph>
          <LocaleSettingsForm v-model="localeDraft" />
          <Space>
            <Button type="primary" :loading="savingLocale" @click="saveLocale">Kaydet</Button>
          </Space>
        </Card>
      </TabPane>

      <TabPane key="security" tab="Güvenlik">
        <Card title="Güvenlik">
          <PasswordSection />
        </Card>
      </TabPane>

      <TabPane key="banking" tab="Bankacılık">
        <Card title="Bankacılık referansı">
          <Typography.Paragraph class="kp-text-muted">
            Kredi kartı, nakit avans ve tüketici kredisi hesaplamalarında varsayılan
            olarak kullanılan referans oranlar. Sözleşmeniz farklıysa kayıt açarken
            kendi oranınızı her zaman override edebilirsiniz.
          </Typography.Paragraph>
          <BankingPresetSection />
        </Card>
      </TabPane>

      <TabPane key="data" tab="Veri">
        <Card title="Yedek ve içe aktarma">
          <DataBackupSection />
        </Card>
      </TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.kp-settings :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
}
</style>
