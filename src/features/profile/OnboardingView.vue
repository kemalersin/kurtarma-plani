<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Card, Typography } from 'ant-design-vue'
import {
  CheckOutlined,
  DatabaseOutlined,
  GithubOutlined,
  LeftOutlined,
  RightOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'
import BrandMark from '@/components/icons/BrandMark.vue'
import { APP_GITHUB_URL, APP_NAME } from '@/core/constants'
import { completeOnboarding } from '@/core/onboarding'

const router = useRouter()
const isMobileShell = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const navButtonSize = computed(() => (isMobileShell.value ? 'middle' : 'large'))

interface OnboardingBullet {
  text: string
}

interface OnboardingStep {
  key: string
  kicker: string
  title: string
  lead: string
  icon?: typeof DatabaseOutlined
  hero?: boolean
  bullets: OnboardingBullet[]
  footnote?: string
}

const steps: OnboardingStep[] = [
  {
    key: 'welcome',
    kicker: 'Hoş geldiniz',
    title: APP_NAME,
    lead: 'Borç, nakit akışı ve finansal planlamanızı tek yerden yönetin. Verileriniz varsayılan olarak yalnızca bu cihazda kalır.',
    hero: true,
    bullets: [],
    footnote: 'Çevrimdışı finans · Çoklu profil · Gizlilik odaklı',
  },
  {
    key: 'local',
    kicker: 'Yerel öncelikli',
    title: 'Veriler sizde',
    lead: 'Sunucuya finans kaydı gönderilmez. İnternet olmadan borç, gelir, gider ve analiz kullanılabilir.',
    icon: DatabaseOutlined,
    bullets: [
      { text: 'Tarayıcıda saklama; isteğe bağlı profil parolası' },
      { text: 'Profiller birbirinden izole, önemli veriler güvende' },
      { text: 'Yerel yedek; hassas kayıtlar dışa aktarımda onayınızla' },
    ],
  },
  {
    key: 'sync',
    kicker: 'Cihazlar arası',
    title: 'Otomatik senkron',
    lead: 'Her profil için bir senkron dosyası; iCloud, Dropbox veya istediğiniz klasörde saklanabilir.',
    icon: SyncOutlined,
    bullets: [
      { text: 'Otomatik yazma veya manuel indir/yükle' },
      { text: 'Dosya şifreleme; profil parolası seçeneği' },
      { text: 'Çakışmada hangi sürümün geçerli olacağını siz seçin' },
    ],
    footnote: 'Ayarlar → Senkron sekmesinden etkinleştirilir.',
  },
  {
    key: 'ai',
    kicker: 'İsteğe bağlı',
    title: 'AI asistan',
    lead: 'Çevrimiçiyken akışlı sohbet ve finans özetine dayalı öneriler.',
    icon: RobotOutlined,
    bullets: [
      { text: 'Bağlantı anahtarları yalnızca cihazınızda saklanır' },
      { text: 'Hassas kayıtlar yapay zeka özetine varsayılan olarak dahil değil' },
      { text: '«AI dışa aktar» ile sohbet uygulamalarına veri gönderebilirsiniz' },
    ],
    footnote: 'AI kullanmasanız da uygulama tam işlevli kalır.',
  },
  {
    key: 'ready',
    kicker: 'Son adım',
    title: 'Kuruluma hazırsınız',
    lead: 'Profil adı, bölgesel ayarlar ve isteğe bağlı parola. Yedekten geri yükleme kurulumda mümkün.',
    icon: SafetyCertificateOutlined,
    bullets: [
      { text: 'Finansal danışmanlık veya yatırım tavsiyesi sunulmaz' },
      { text: 'Kurulumda yasal uyarı onayı istenir' },
      { text: 'İsterseniz örnek verilerle başlayabilirsiniz' },
    ],
  },
]

const stepIndex = ref(0)

const currentStep = computed(() => steps[stepIndex.value]!)
const isFirst = computed(() => stepIndex.value === 0)
const isLast = computed(() => stepIndex.value === steps.length - 1)
const progressPercent = computed(
  () => Math.round(((stepIndex.value + 1) / steps.length) * 100),
)

function goNext(): void {
  if (isLast.value) {
    startSetup()
    return
  }
  stepIndex.value += 1
}

function goBack(): void {
  if (isFirst.value) return
  stepIndex.value -= 1
}

function startSetup(): void {
  completeOnboarding()
  void router.push({ name: 'setup' })
}
</script>

<template>
  <div class="kp-center-page kp-center-page--onboarding">
    <Card class="kp-card kp-onboarding">
      <header class="kp-onboarding__header">
        <div
          class="kp-onboarding__progress-track"
          role="progressbar"
          :aria-valuenow="stepIndex + 1"
          :aria-valuemin="1"
          :aria-valuemax="steps.length"
          :aria-label="`Adım ${stepIndex + 1} / ${steps.length}`"
        >
          <div
            class="kp-onboarding__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <Typography.Text type="secondary" class="kp-onboarding__step-count">
          {{ stepIndex + 1 }} / {{ steps.length }}
        </Typography.Text>
      </header>

      <div class="kp-onboarding__stage">
        <Transition name="kp-onboarding-fade" mode="out-in">
          <div :key="currentStep.key" class="kp-onboarding__panel">
            <Typography.Text type="secondary" class="kp-onboarding__kicker">
              {{ currentStep.kicker }}
            </Typography.Text>

            <div class="kp-onboarding__visual">
              <BrandMark
                v-if="currentStep.hero"
                class="kp-onboarding__logo"
                aria-hidden="true"
              />
              <component
                :is="currentStep.icon"
                v-else
                class="kp-onboarding__icon"
                aria-hidden="true"
              />
            </div>

            <Typography.Title :level="4" class="kp-onboarding__title">
              {{ currentStep.title }}
            </Typography.Title>

            <Typography.Paragraph class="kp-text-muted kp-onboarding__lead">
              {{ currentStep.lead }}
            </Typography.Paragraph>

            <ul
              class="kp-onboarding__bullets"
              :class="{ 'kp-onboarding__bullets--empty': !currentStep.bullets.length }"
            >
              <li v-for="(bullet, idx) in currentStep.bullets" :key="idx">
                <CheckOutlined class="kp-onboarding__bullet-icon" aria-hidden="true" />
                <span>{{ bullet.text }}</span>
              </li>
            </ul>

            <Typography.Paragraph
              type="secondary"
              class="kp-onboarding__footnote"
              :class="{ 'kp-onboarding__footnote--empty': !currentStep.footnote }"
            >
              {{ currentStep.footnote ?? '\u00a0' }}
            </Typography.Paragraph>
          </div>
        </Transition>
      </div>

      <footer class="kp-onboarding__footer">
        <Button
          v-if="!isFirst"
          :size="navButtonSize"
          class="kp-onboarding__nav-btn"
          @click="goBack"
        >
          <template #icon><LeftOutlined /></template>
          Geri
        </Button>
        <Button
          type="primary"
          :size="navButtonSize"
          class="kp-onboarding__nav-btn"
          @click="goNext"
        >
          {{ isLast ? 'Kuruluma başla' : 'İleri' }}
          <template v-if="!isLast" #icon><RightOutlined /></template>
        </Button>
      </footer>

      <button
        v-if="!isLast"
        type="button"
        class="kp-onboarding__skip"
        @click="startSetup"
      >
        Kuruluma atla
      </button>
      <a
        v-else
        class="kp-onboarding__skip kp-onboarding__skip--contrib"
        :href="APP_GITHUB_URL"
        target="_blank"
        rel="noopener noreferrer"
      >
        <GithubOutlined class="kp-onboarding__skip-icon" aria-hidden="true" />
        <span>Katkıda bulunun</span>
        <span class="kp-onboarding__skip-dot" aria-hidden="true" />
        <span>Açık Kaynak</span>
      </a>
    </Card>
  </div>
</template>

<style scoped>
.kp-onboarding {
  --kp-onboarding-body-h: 34rem;
  --kp-onboarding-stage-h: 22.5rem;
  --kp-onboarding-footer-gap: 24px;
  --kp-onboarding-skip-gap: 14px;
}

.kp-onboarding :deep(.ant-card-body) {
  box-sizing: border-box;
  height: var(--kp-onboarding-body-h);
  max-height: min(var(--kp-onboarding-body-h), calc(100dvh - 40px));
  padding: 20px 24px 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.kp-onboarding__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.kp-onboarding__progress-track {
  flex: 1;
  height: 3px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

[data-theme='dark'] .kp-onboarding__progress-track {
  background: rgba(255, 255, 255, 0.1);
}

.kp-onboarding__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--ant-color-primary, #1677ff);
  transition: width 0.3s ease;
}

.kp-onboarding__step-count {
  flex-shrink: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.kp-onboarding__stage {
  flex: 1;
  min-height: var(--kp-onboarding-stage-h);
  height: var(--kp-onboarding-stage-h);
  overflow: hidden;
}

.kp-onboarding__panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4px;
  box-sizing: border-box;
}

.kp-onboarding__kicker {
  flex-shrink: 0;
  display: block;
  width: 100%;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.kp-onboarding__visual {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 5.5rem;
  margin-bottom: 14px;
}

.kp-onboarding__logo {
  width: 5.5rem;
  height: 5.5rem;
  font-size: 5.5rem;
  color: var(--ant-color-primary, #1677ff);
}

.kp-onboarding__icon {
  font-size: 2.5rem;
  color: var(--ant-color-primary, #1677ff);
  line-height: 1;
}

.kp-onboarding__title {
  flex-shrink: 0;
  margin: 0 0 8px !important;
  font-size: 1.125rem !important;
  line-height: 1.35 !important;
}

.kp-onboarding__lead {
  flex-shrink: 0;
  width: 100%;
  max-width: 26rem;
  margin: 0 0 14px !important;
  font-size: 13px;
  line-height: 1.55;
}

.kp-onboarding__bullets {
  flex-shrink: 0;
  list-style: none;
  width: 100%;
  max-width: 26rem;
  min-height: 5.25rem;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
  text-align: left;
}

.kp-onboarding__bullets--empty {
  visibility: hidden;
  pointer-events: none;
}

.kp-onboarding__bullets li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.72);
}

[data-theme='dark'] .kp-onboarding__bullets li {
  color: rgba(255, 255, 255, 0.75);
}

.kp-onboarding__bullet-icon {
  flex-shrink: 0;
  margin-top: 4px;
  font-size: 11px;
  color: var(--ant-color-primary, #1677ff);
}

.kp-onboarding__footnote {
  flex-shrink: 0;
  width: 100%;
  max-width: 26rem;
  min-height: 2.5rem;
  margin: 10px 0 0 !important;
  font-size: 12px;
  line-height: 1.45;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kp-onboarding__footnote--empty {
  visibility: hidden;
}

.kp-onboarding__footer {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  margin-top: var(--kp-onboarding-footer-gap);
}

.kp-onboarding__nav-btn {
  flex: 1;
  min-width: 0;
}

.kp-onboarding__skip {
  flex-shrink: 0;
  display: block;
  width: 100%;
  margin-top: var(--kp-onboarding-skip-gap);
  padding: 2px;
  min-height: 1.25rem;
  border: none;
  background: none;
  font-size: 12px;
  line-height: 1.25;
  color: rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

a.kp-onboarding__skip {
  text-align: center;
  text-decoration: none;
}

.kp-onboarding__skip--contrib {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.kp-onboarding__skip-icon {
  font-size: 13px;
}

.kp-onboarding__skip-dot {
  flex-shrink: 0;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.45;
}

.kp-onboarding__skip:hover {
  color: var(--ant-color-primary, #1677ff);
}

[data-theme='dark'] .kp-onboarding__skip {
  color: rgba(255, 255, 255, 0.4);
}

.kp-onboarding-fade-enter-active,
.kp-onboarding-fade-leave-active {
  transition: opacity 0.18s ease;
}

.kp-onboarding-fade-enter-from,
.kp-onboarding-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .kp-center-page--onboarding {
    padding: 10px 12px;
    align-items: stretch;
  }

  .kp-center-page--onboarding > .kp-onboarding {
    flex: 1;
    min-height: 0;
    max-width: none;
    margin-block: 0;
    display: flex;
    flex-direction: column;
  }

  .kp-onboarding :deep(.ant-card-body) {
    flex: 1;
    min-height: 0;
    height: calc(100dvh - 20px);
    max-height: calc(100dvh - 20px);
    padding: 12px 14px 8px;
  }

  .kp-onboarding__header {
    margin-bottom: 10px;
  }

  .kp-onboarding__stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .kp-onboarding__panel {
    flex: 1 0 auto;
    min-height: 100%;
    height: auto;
    justify-content: center;
    padding: 10px 0 12px;
    box-sizing: border-box;
  }

  .kp-onboarding__kicker {
    margin-bottom: 8px;
  }

  .kp-onboarding__visual {
    height: 3.75rem;
    margin-bottom: 10px;
  }

  .kp-onboarding__logo {
    width: 3.75rem;
    height: 3.75rem;
    font-size: 3.75rem;
  }

  .kp-onboarding__icon {
    font-size: 2rem;
  }

  .kp-onboarding__title {
    font-size: 1rem !important;
    margin-bottom: 6px !important;
  }

  .kp-onboarding__lead {
    margin-bottom: 10px !important;
    font-size: 12px;
  }

  .kp-onboarding__bullets {
    min-height: 3.75rem;
    gap: 6px;
  }

  .kp-onboarding__bullets li {
    font-size: 12px;
  }

  .kp-onboarding__footnote {
    min-height: 2rem;
    margin-top: 6px !important;
    font-size: 11px;
  }

  .kp-onboarding {
    --kp-onboarding-footer-gap: 18px;
    --kp-onboarding-skip-gap: 12px;
  }

  .kp-onboarding__footer {
    flex-direction: row;
    gap: 8px;
    margin-top: var(--kp-onboarding-footer-gap);
  }

  .kp-onboarding__footer :deep(.ant-btn) {
    height: 34px;
    padding-inline: 10px;
    font-size: 14px;
  }

  .kp-onboarding__footer :deep(.ant-btn-icon) {
    font-size: 13px;
  }

  .kp-onboarding__nav-btn {
    flex: 1;
    min-width: 0;
  }

  .kp-onboarding__skip {
    margin-top: var(--kp-onboarding-skip-gap);
    font-size: 11px;
  }
}
</style>
