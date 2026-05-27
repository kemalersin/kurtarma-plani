<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    /** Mobilde başlık göster (varsayılan gizli). Yalnızca Panel ana sayfasında true. */
    showOnMobile?: boolean
  }>(),
  { showOnMobile: false },
)
</script>

<template>
  <header
    class="kp-page-header"
    :class="{ 'kp-page-header--show-mobile': showOnMobile }"
  >
    <h1 class="kp-page-header__title">{{ title }}</h1>
    <p v-if="subtitle || $slots.subtitle" class="kp-page-header__subtitle">
      <slot name="subtitle">{{ subtitle }}</slot>
    </p>
  </header>
</template>

<style scoped>
.kp-page-header {
  margin: 12px 0 20px;
}

.kp-page-header__title {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.kp-page-header__subtitle {
  margin: 8px 0 0;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.5);
  line-height: 1.5;
}

[data-theme='dark'] .kp-page-header__title {
  color: rgba(255, 255, 255, 0.92);
}

[data-theme='dark'] .kp-page-header__subtitle {
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .kp-page-header:not(.kp-page-header--show-mobile) {
    display: none;
  }
}

@media (max-width: 640px) {
  .kp-page-header {
    margin: 8px 0 16px;
  }

  .kp-page-header__title {
    font-size: 24px;
  }

  .kp-page-header__subtitle {
    font-size: 14px;
  }
}
</style>
