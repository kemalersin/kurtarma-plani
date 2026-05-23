<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Card,
  List,
  ListItem,
  ListItemMeta,
  Avatar,
  Button,
  InputPassword,
  Form,
  FormItem,
  Empty,
  Typography,
  Tag,
  Popconfirm,
  Space,
  message,
} from 'ant-design-vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { APP_NAME } from '@/core/constants'
import type { ProfileMeta } from '@/core/types/profile'

const profileStore = useProfileStore()
const router = useRouter()

const selectedId = ref<string | null>(null)
const password = ref('')
const submitting = ref(false)
const deletingId = ref<string | null>(null)

const selectedProfile = computed<ProfileMeta | null>(() =>
  profileStore.profiles.find((p) => p.id === selectedId.value) ?? null,
)

const profilesSorted = computed<ProfileMeta[]>(() =>
  [...profileStore.profiles].sort((a, b) => {
    const ad = a.lastOpenedAt ?? a.createdAt
    const bd = b.lastOpenedAt ?? b.createdAt
    return bd.localeCompare(ad)
  }),
)

watch(profilesSorted, (list) => {
  if (!selectedId.value && list.length > 0) {
    selectedId.value = list[0].id
  }
}, { immediate: true })

async function open(): Promise<void> {
  if (!selectedProfile.value) return
  const needsPassword = selectedProfile.value.password.enabled
  if (needsPassword && password.value.length === 0) {
    message.error('Parola gerekli.')
    return
  }
  submitting.value = true
  try {
    const ok = await profileStore.selectProfile(
      selectedProfile.value.id,
      needsPassword ? password.value : undefined,
    )
    if (ok) {
      await router.push({ name: 'home' })
    } else {
      message.error('Parola yanlış veya profil açılamadı.')
    }
  } finally {
    submitting.value = false
  }
}

function newProfile(): void {
  router.push({ name: 'setup' })
}

function restoreProfile(): void {
  router.push({ name: 'setup', query: { tab: 'restore' } })
}

async function deleteProfile(id: string, name: string): Promise<void> {
  deletingId.value = id
  try {
    await profileStore.removeProfile(id)
    if (selectedId.value === id) {
      password.value = ''
      selectedId.value = profileStore.profiles[0]?.id ?? null
    }
    message.success(`Profil silindi: ${name}`)
  } catch (error) {
    console.error(error)
    message.error('Profil silinemedi.')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="kp-center-page">
    <Card class="kp-card" :title="`${APP_NAME} · Profil Seç`">
      <Empty v-if="profilesSorted.length === 0" description="Henüz profil yok.">
        <Space direction="vertical" :size="8">
          <Button type="primary" @click="newProfile">Yeni profil oluştur</Button>
          <Button @click="restoreProfile">Yedekten / senkron'dan geri yükle</Button>
        </Space>
      </Empty>

      <template v-else>
        <Typography.Paragraph class="kp-text-muted">
          Açmak istediğiniz profili seçin.
        </Typography.Paragraph>

        <List item-layout="horizontal" :data-source="profilesSorted" class="kp-profile-list">
          <template #renderItem="{ item }">
            <ListItem
              :class="{ 'kp-profile-list__item--selected': item.id === selectedId }"
              class="kp-profile-list__item"
              @click="selectedId = item.id"
            >
              <ListItemMeta>
                <template #avatar>
                  <Avatar style="background: #1677ff">{{ item.name.charAt(0).toUpperCase() }}</Avatar>
                </template>
                <template #title>
                  {{ item.name }}
                  <Tag v-if="item.password.enabled" color="blue" style="margin-left: 6px">
                    Parolalı
                  </Tag>
                </template>
                <template #description>
                  {{ item.localeSettings.locale }} · {{ item.localeSettings.currency }} ·
                  {{ item.localeSettings.timeZone }}
                </template>
              </ListItemMeta>
              <template #actions>
                <Popconfirm
                  :title="`「${item.name}」 ve tüm verileri silinsin mi?`"
                  ok-text="Sil"
                  cancel-text="Vazgeç"
                  ok-type="danger"
                  @confirm="deleteProfile(item.id, item.name)"
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    :loading="deletingId === item.id"
                    aria-label="Profili sil"
                    @click.stop
                  >
                    <DeleteOutlined />
                  </Button>
                </Popconfirm>
              </template>
            </ListItem>
          </template>
        </List>

        <Form
          v-if="selectedProfile?.password.enabled"
          layout="vertical"
          :colon="false"
          style="margin-top: 16px"
          @submit.prevent="open"
        >
          <FormItem :label="`Parola: ${selectedProfile.name}`" required>
            <InputPassword v-model:value="password" autofocus />
          </FormItem>
        </Form>

        <div class="kp-profile-list__footer">
          <Button type="primary" :loading="submitting" :disabled="!selectedProfile" @click="open">
            Aç
          </Button>
          <Button @click="newProfile">Yeni profil</Button>
          <Button @click="restoreProfile">Yedekten geri yükle</Button>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.kp-profile-list__item {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
}

.kp-profile-list__item--selected {
  background: rgba(22, 119, 255, 0.08);
}

.kp-profile-list__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.kp-profile-list :deep(.ant-list-item-action) {
  margin-inline-start: 12px;
}
</style>
