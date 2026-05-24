<script setup lang="ts">
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  DescriptionsItem,
  Row,
  Space,
  Tag,
  Typography,
} from 'ant-design-vue'
import {
  DatabaseOutlined,
  GithubOutlined,
  LockOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import KpNotice from '@/components/KpNotice.vue'
import BrandMark from '@/components/icons/BrandMark.vue'
import CoffeeIcon from '@/components/icons/CoffeeIcon.vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { APP_BUILD_DATE, APP_GITHUB_PAGES_RAW_INDEX_URL, APP_GITHUB_PAGES_URL, APP_GITHUB_URL, APP_NAME, APP_SUPPORT_URL, APP_VERSION } from '@/core/constants'

const { formatDateLong } = useLocaleFormatters()

const highlights = [
  {
    icon: DatabaseOutlined,
    title: 'Veriler cihazınızda',
    text: 'Backend yok; tüm kayıtlar tarayıcıda IndexedDB üzerinde tutulur. İsteğe bağlı profil parolası ile şifreleme.',
  },
  {
    icon: ThunderboltOutlined,
    title: 'Çevrimdışı öncelikli',
    text: 'Finans modülü internet olmadan tam işlevli. Bankacılık preset güncellemesi yalnızca çevrimiçiyken, kullanıcı tetiklemeli.',
  },
  {
    icon: TeamOutlined,
    title: 'Çoklu profil',
    text: 'Aynı tarayıcıda birden fazla finansal profil; her profil izole veri alanına sahiptir.',
  },
  {
    icon: LockOutlined,
    title: 'Gizlilik odaklı',
    text: 'Hassas kayıtlar ve API anahtarları dışa aktarımda sizin onayınızla; AI sohbetine asla gönderilmez.',
  },
  {
    icon: SyncOutlined,
    title: 'Otomatik senkron',
    text: 'Profil başına .sync dosyası ile cihazlar arası eşitleme; isteğe bağlı dosya şifreleme, otomatik yazma ve uzaktan okuma. Bulut klasörüne (iCloud, Dropbox vb.) koyarak kullanılır.',
  },
  {
    icon: RobotOutlined,
    title: 'AI asistan',
    text: 'Çevrimiçiyken akışlı sohbet; finans özetinize dayalı öneriler ve maliyet takibi. API anahtarları modele gönderilmez; hassas kayıtlar AI özetine dahil edilmez.',
  },
] as const

const techStack = [
  'Vue 3',
  'TypeScript',
  'Ant Design Vue',
  'IndexedDB / Dexie',
  'Web Crypto',
  'ECharts',
  'decimal.js',
] as const
</script>

<template>
  <div class="kp-about">
    <PageHeader
      title="Hakkında"
      subtitle="Kurtarma Planı; borç, gelir-gider ve nakit akışını kişisel olarak takip etmeniz için tasarlanmış açık kaynaklı bir uygulamadır."
    />

    <Card class="kp-about__hero" :bordered="false">
      <div class="kp-about__hero-inner">
        <div class="kp-about__hero-main">
          <div class="kp-about__brand" aria-hidden="true">
            <BrandMark />
          </div>
          <div class="kp-about__hero-text">
            <Typography.Title :level="3" class="kp-about__hero-title">
              {{ APP_NAME }}
            </Typography.Title>
            <Typography.Paragraph class="kp-about__hero-tagline">
              Kişisel finansal planlama — tek dosyada, çevrimdışı çalışır.
            </Typography.Paragraph>
            <Space wrap :size="8">
              <Tag color="blue">v{{ APP_VERSION }}</Tag>
              <Tag>Derleme {{ formatDateLong(APP_BUILD_DATE) }}</Tag>
              <Tag color="green">Açık kaynak</Tag>
            </Space>
          </div>
        </div>
        <Button
          type="primary"
          class="kp-about__coffee-btn"
          size="large"
          :href="APP_SUPPORT_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          <template #icon><CoffeeIcon /></template>
          Kahve Ismarla
        </Button>
      </div>
    </Card>

    <Row :gutter="[16, 16]" class="kp-about__grid">
      <Col v-for="item in highlights" :key="item.title" :xs="24" :sm="12">
        <Card class="kp-about__feature" :bordered="false">
          <div class="kp-about__feature-icon">
            <component :is="item.icon" />
          </div>
          <Typography.Title :level="5" class="kp-about__feature-title">
            {{ item.title }}
          </Typography.Title>
          <Typography.Paragraph class="kp-about__feature-text">
            {{ item.text }}
          </Typography.Paragraph>
        </Card>
      </Col>
    </Row>

    <Card class="kp-about__opensource" :bordered="false">
      <Space direction="vertical" :size="16" style="width: 100%">
        <div class="kp-about__opensource-head">
          <SafetyCertificateOutlined class="kp-about__opensource-icon" />
          <div>
            <Typography.Title :level="4" class="kp-about__section-title">
              Açık kaynak
            </Typography.Title>
            <Typography.Paragraph class="kp-about__section-lead">
              Kaynak kodu herkese açıktır. Hata bildirimi, öneri ve katkılar GitHub üzerinden
              yapılabilir. Uygulama tek HTML dosyası olarak derlenir; verileriniz yine yalnızca
              sizin cihazınızda kalır.
            </Typography.Paragraph>
          </div>
        </div>

        <Space wrap :size="12">
          <Button type="default" size="large" :href="APP_GITHUB_URL" target="_blank" rel="noopener noreferrer">
            <template #icon><GithubOutlined /></template>
            Kaynak kodu
          </Button>
          <Button type="primary" size="large" :href="APP_GITHUB_PAGES_URL" target="_blank" rel="noopener noreferrer">
            Canlı sürüm
          </Button>
          <Button size="large" :href="APP_GITHUB_PAGES_RAW_INDEX_URL" target="_blank" rel="noopener noreferrer">
            index.html indir
          </Button>
        </Space>
      </Space>
    </Card>

    <Card class="kp-about__meta" :bordered="false" title="Teknik özet">
      <Descriptions :column="1" size="small" class="kp-about__descriptions">
        <DescriptionsItem label="Dağıtım">Tek dosya SPA (Vite + vite-plugin-singlefile)</DescriptionsItem>
        <DescriptionsItem label="Veri">IndexedDB; isteğe bağlı otomatik senkron dosyası</DescriptionsItem>
        <DescriptionsItem label="Depo">
          <a :href="APP_GITHUB_URL" target="_blank" rel="noopener noreferrer">github.com/kemalersin/kurtarma-plani</a>
        </DescriptionsItem>
      </Descriptions>
      <Space wrap :size="[8, 8]" class="kp-about__tags">
        <Tag v-for="tech in techStack" :key="tech">{{ tech }}</Tag>
      </Space>
    </Card>

    <KpNotice
      tone="legal"
      title="Bu uygulama yalnızca bilgilendirme ve kişisel planlama amaçlıdır."
      detail="Bağlayıcı sonuç için bankanızın sözleşmesi, ekstresi ve resmi mevzuat geçerlidir."
    />

    <Alert
      type="info"
      show-icon
      message="Dağıtım notu"
      description="Production çıktısı file:// ile açılabilir; harici CDN veya backend gerektirmez. Web fontları yüklenmezse sistem yazı tipi kullanılır."
      class="kp-about__note"
    />
  </div>
</template>

<style scoped>
.kp-about {
  padding-bottom: 32px;
}

.kp-about__hero,
.kp-about__feature,
.kp-about__meta {
  margin-bottom: 16px;
  border-radius: 12px;
}

.kp-about__opensource {
  margin-top: 16px;
  margin-bottom: 16px;
  border-radius: 12px;
}

.kp-about__hero {
  background: linear-gradient(
    135deg,
    rgba(22, 119, 255, 0.08) 0%,
    rgba(22, 119, 255, 0.02) 100%
  );
}

[data-theme='dark'] .kp-about__hero {
  background: linear-gradient(
    135deg,
    rgba(22, 119, 255, 0.16) 0%,
    rgba(255, 255, 255, 0.03) 100%
  );
}

.kp-about__hero-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.kp-about__hero-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
  flex: 1;
}

.kp-about__coffee-btn.ant-btn {
  flex-shrink: 0;
}

.kp-about__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  font-size: 56px;
  flex-shrink: 0;
}

[data-theme='dark'] .kp-about__brand {
  color: #4096ff;
}

.kp-about__hero-title {
  margin: 0 0 4px !important;
}

.kp-about__hero-tagline {
  margin: 0 0 12px !important;
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-about__hero-tagline {
  color: rgba(255, 255, 255, 0.55);
}

.kp-about__feature {
  height: 100%;
}

.kp-about__feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
  font-size: 20px;
}

[data-theme='dark'] .kp-about__feature-icon {
  background: rgba(22, 119, 255, 0.18);
  color: #4096ff;
}

.kp-about__feature-title {
  margin: 0 0 8px !important;
}

.kp-about__feature-text {
  margin: 0 !important;
  color: rgba(0, 0, 0, 0.65);
  line-height: 1.6;
}

[data-theme='dark'] .kp-about__feature-text {
  color: rgba(255, 255, 255, 0.65);
}

.kp-about__opensource-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.kp-about__opensource-icon {
  font-size: 28px;
  color: #52c41a;
  margin-top: 4px;
  flex-shrink: 0;
}

.kp-about__section-title {
  margin: 0 0 8px !important;
}

.kp-about__section-lead {
  margin: 0 !important;
  color: rgba(0, 0, 0, 0.65);
  line-height: 1.65;
  max-width: 56rem;
}

[data-theme='dark'] .kp-about__section-lead {
  color: rgba(255, 255, 255, 0.65);
}

.kp-about__tags {
  margin-top: 16px;
}

.kp-about__descriptions :deep(.ant-descriptions-item-label) {
  width: 120px;
}

.kp-about__note {
  margin-top: 16px;
}

@media (max-width: 640px) {
  .kp-about__hero-inner {
    flex-direction: column;
    align-items: stretch;
  }

  .kp-about__hero-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .kp-about__coffee-btn.ant-btn {
    width: 100%;
  }

  .kp-about__brand {
    font-size: 44px;
  }
}
</style>
