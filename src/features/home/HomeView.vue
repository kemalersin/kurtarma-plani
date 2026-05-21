<script setup lang="ts">
import { computed } from 'vue'
import { Card, Row, Col, Statistic, Alert, Space } from 'ant-design-vue'
import { useProfileStore } from '@/stores/profile'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import PageHeader from '@/components/PageHeader.vue'
import { APP_NAME, APP_VERSION, APP_BUILD_DATE } from '@/core/constants'

const profileStore = useProfileStore()
const profile = computed(() => profileStore.activeProfile)

const subtitle = computed(
  () =>
    `${APP_NAME} · v${APP_VERSION} · Derleme: ${APP_BUILD_DATE.slice(0, 10)}`,
)
</script>

<template>
  <PageHeader
    :title="profile ? `Hoş geldiniz, ${profile.name}` : 'Hoş geldiniz'"
    :subtitle="subtitle"
  />

  <AppDisclaimer />

  <Space direction="vertical" size="large" style="width: 100%; margin-top: 16px">
    <Card>
      <Alert
        type="info"
        show-icon
        message="M1 (uygulama iskeleti) tamamlandı."
        description="Sıradaki fazlarda veri katmanı (M2), yönetimsel veriler (M3), kredi/kart/avans (M4–M5), nakit akışı (M6), analiz (M7) ve AI (M8) gelecek."
      />
    </Card>

    <Row :gutter="[16, 16]">
      <Col :xs="24" :sm="12" :md="8">
        <Card>
          <Statistic title="Aktif profil" :value="profile?.name ?? '—'" />
        </Card>
      </Col>
      <Col :xs="24" :sm="12" :md="8">
        <Card>
          <Statistic title="Para birimi" :value="profile?.localeSettings.currency ?? '—'" />
        </Card>
      </Col>
      <Col :xs="24" :sm="12" :md="8">
        <Card>
          <Statistic title="Saat dilimi" :value="profile?.localeSettings.timeZone ?? '—'" />
        </Card>
      </Col>
    </Row>
  </Space>
</template>
