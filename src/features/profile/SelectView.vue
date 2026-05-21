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
  message,
} from 'ant-design-vue'
import { useProfileStore } from '@/stores/profile'
import { APP_NAME } from '@/core/constants'
import type { ProfileMeta } from '@/core/types/profile'

const profileStore = useProfileStore()
const router = useRouter()

const selectedId = ref<string | null>(null)
const password = ref('')
const submitting = ref(false)

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
</script>

<template>
  <div class="kp-center-page">
    <Card class="kp-card" :title="`${APP_NAME} · Profil Seç`">
      <Empty v-if="profilesSorted.length === 0" description="Henüz profil yok.">
        <Button type="primary" @click="newProfile">Yeni profil oluştur</Button>
      </Empty>

      <template v-else>
        <Typography.Paragraph class="kp-text-muted">
          Açmak istediğiniz profili seçin.
        </Typography.Paragraph>

        <List item-layout="horizontal" :data-source="profilesSorted">
          <template #renderItem="{ item }">
            <ListItem
              :class="{ 'kp-selected': item.id === selectedId }"
              style="cursor: pointer; padding: 8px 12px; border-radius: 6px"
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

        <div style="display: flex; gap: 8px; margin-top: 16px">
          <Button type="primary" :loading="submitting" :disabled="!selectedProfile" @click="open">
            Aç
          </Button>
          <Button @click="newProfile">Yeni profil</Button>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.kp-selected {
  background: rgba(22, 119, 255, 0.08);
}
</style>
