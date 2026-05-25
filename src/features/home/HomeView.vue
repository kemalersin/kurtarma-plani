<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Row, Col, Card, Spin, Button, Progress } from 'ant-design-vue'
import {
  CreditCardOutlined,
  SwapOutlined,
  DatabaseOutlined,
  RightOutlined,
  WalletOutlined,
  BankOutlined,
} from '@ant-design/icons-vue'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import PageHeader from '@/components/PageHeader.vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import KpChart from '@/components/KpChart.vue'
import KpNotice from '@/components/KpNotice.vue'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import { useDashboardData } from '@/features/analytics/useDashboardData'
import { buildDonutOption } from '@/features/analytics/chartOptions'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { useProfileStore } from '@/stores/profile'

const router = useRouter()
const profileStore = useProfileStore()
const { formatCurrency, formatNumber, formatDate } = useLocaleFormatters()
const { data, loading } = useDashboardData()

const profile = computed(() => profileStore.activeProfile)
const localCurrency = computed(
  () => profile.value?.localeSettings.currency ?? 'TRY',
)

/** Ana KPI'lar — tek satır, 4 kart. */
const summaryStats = computed<KpStat[]>(() => {
  const d = data.value
  const ratioPct = d.worth.debtToAssetRatio * 100
  const netTone = Number(d.worth.net) >= 0 ? 'success' : 'danger'
  return [
    {
      label: 'Net varlık',
      value: formatCurrency(d.worth.net, localCurrency.value),
      hint: `Borç / varlık ${formatNumber(ratioPct, { maximumFractionDigits: 1 })}%`,
      tone: netTone,
    },
    {
      label: 'Toplam varlık',
      value: formatCurrency(d.worth.assets, localCurrency.value),
      hint: `${d.assets.perAccount.length} hesap · ${d.assets.perRegister.length} kasa`,
      tone: 'primary',
    },
    {
      label: 'Toplam borç',
      value: formatCurrency(d.worth.debts, localCurrency.value),
      hint:
        d.debts.overdueCount === 0
          ? 'Vade dikkati yok'
          : `${d.debts.overdueCount} gecikmiş taksit`,
      tone: d.debts.overdueCount > 0 ? 'danger' : 'default',
    },
    {
      label: 'Bu ay net',
      value: formatCurrency(d.currentMonth.net, localCurrency.value),
      hint: `${formatCurrency(d.currentMonth.income, localCurrency.value)} gelir · ${formatCurrency(d.currentMonth.expense, localCurrency.value)} gider`,
      tone: d.currentMonth.net >= 0 ? 'success' : 'warning',
    },
  ]
})

const debtTypeStats = computed(() => {
  const bt = data.value.debts.byType
  return [
    { key: 'loans', label: 'Krediler', value: bt.loans, color: '#1677ff' },
    { key: 'creditCards', label: 'Kredi kartları', value: bt.creditCards, color: '#fa8c16' },
    { key: 'cashAdvances', label: 'Nakit avans', value: bt.cashAdvances, color: '#722ed1' },
    {
      key: 'installmentAdvances',
      label: 'Taksitli avans',
      value: bt.installmentAdvances,
      color: '#13c2c2',
    },
  ].filter((x) => Number(x.value) > 0)
})

const quickLinks = [
  { name: 'debts', label: 'Borçlar', icon: CreditCardOutlined },
  { name: 'cashflow', label: 'Nakit akışı', icon: SwapOutlined },
  { name: 'admin', label: 'Yönetim', icon: DatabaseOutlined },
] as const

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${m}.${y!.slice(2)}`
}

function currencyAxisFormatter(value: number | string): string {
  return formatNumber(Number(value), {
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

function balanceClass(value: string): string {
  return Number(value) < 0 ? 'kp-balance kp-balance--negative' : 'kp-balance'
}

function go(name: string): void {
  void router.push({ name })
}

const cashflowOption = computed<EChartsOption>(() => {
  const d = data.value.cashflow
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) =>
        formatCurrency(Number(v), localCurrency.value),
    },
    legend: { data: ['Gelir', 'Gider', 'Net'], bottom: 0 },
    grid: { left: 56, right: 16, top: 16, bottom: 48 },
    xAxis: {
      type: 'category',
      data: d.months.map(monthLabel),
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: currencyAxisFormatter },
    },
    series: [
      { name: 'Gelir', type: 'bar', data: d.income, itemStyle: { color: '#52c41a' } },
      { name: 'Gider', type: 'bar', data: d.expense, itemStyle: { color: '#ff4d4f' } },
      {
        name: 'Net',
        type: 'line',
        data: d.net,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: '#1677ff' },
        lineStyle: { width: 2 },
      },
    ],
  }
})

const assetTrendOption = computed<EChartsOption>(() => {
  const d = data.value.assetTrend
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) =>
        formatCurrency(Number(v), localCurrency.value),
    },
    grid: { left: 56, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: d.dates.map((iso) => formatDate(iso)),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: currencyAxisFormatter },
    },
    series: [
      {
        name: 'Varlık',
        type: 'line',
        data: d.values,
        smooth: true,
        areaStyle: { opacity: 0.1 },
        itemStyle: { color: '#1677ff' },
        lineStyle: { width: 2 },
      },
    ],
  }
})

const debtBreakdownOption = computed<EChartsOption>(() =>
  buildDonutOption(
    data.value.debts.breakdown.map((item, i) => ({
      name: item.name,
      value: item.value,
      color: ['#1677ff', '#fa8c16', '#722ed1', '#13c2c2'][i % 4],
    })),
    (v) => formatCurrency(v, localCurrency.value),
  ),
)

const incomeCategoryOption = computed<EChartsOption>(() =>
  buildDonutOption(
    data.value.incomesByCategory,
    (v) => formatCurrency(v, localCurrency.value),
  ),
)

const expenseCategoryOption = computed<EChartsOption>(() =>
  buildDonutOption(
    data.value.expensesByCategory,
    (v) => formatCurrency(v, localCurrency.value),
  ),
)

const upcomingDebtOption = computed<EChartsOption>(() => {
  const d = data.value.upcomingDebts
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) =>
        formatCurrency(Number(v), localCurrency.value),
    },
    grid: { left: 56, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: d.months.map(monthLabel),
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: currencyAxisFormatter },
    },
    series: [
      {
        name: 'Vade',
        type: 'bar',
        data: d.scheduled,
        itemStyle: { color: '#fa8c16' },
      },
    ],
  }
})

const hasCashflow = computed(
  () =>
    data.value.cashflow.income.some((v) => v > 0) ||
    data.value.cashflow.expense.some((v) => v > 0),
)
const hasAssetTrend = computed(() => data.value.assetTrend.values.some((v) => v !== 0))
const hasDebts = computed(() => data.value.debts.breakdown.length > 0)
const hasIncomeCategories = computed(
  () => data.value.incomesByCategory.length > 0,
)
const hasExpenseCategories = computed(
  () => data.value.expensesByCategory.length > 0,
)
const hasUpcoming = computed(() =>
  data.value.upcomingDebts.scheduled.some((v) => v > 0),
)

const coveragePercent = computed(() => {
  const cov = data.value.debtCoverage30
  const due = Number(cov.debtDue)
  if (due <= 0) return cov.canCover ? 100 : 0
  const raw = cov.coveragePercent * 100
  if (cov.canCover) return Math.min(100, Math.round(raw))
  return Math.min(99, Math.floor(raw))
})

const hasOverdueCashflow = computed(
  () =>
    data.value.cashflowAttention.overdueIncomes +
      data.value.cashflowAttention.overdueExpenses >
    0,
)

const dashCardBody = { padding: '12px 16px 16px' }
</script>

<template>
  <div class="kp-dashboard-page">
    <div v-if="loading" class="kp-page-spinner">
      <Spin size="large" />
    </div>

    <template v-else>
      <div class="kp-dashboard-page__notices">
        <AppDisclaimer />
        <KpNotice
          v-if="hasOverdueCashflow"
          tone="error"
          title="Gecikmiş gelir veya gider kayıtları var."
          detail="Vadesi geçmiş kayıtları gerçekleştirin veya planı güncelleyin."
        >
          <template #action>
            <Button size="small" type="primary" @click="go('cashflow')">
              Nakit akışına git
            </Button>
          </template>
        </KpNotice>
      </div>

      <PageHeader
        show-on-mobile
        :title="profile ? `Hoş geldiniz, ${profile.name}` : 'Panel'"
        subtitle="Finansal durum özeti"
      />

      <div class="kp-dashboard">
        <KpStatRow :items="summaryStats" :min-column-width="180" />

        <Row :gutter="[20, 20]" class="kp-dashboard__main">
          <!-- Sol: ana grafikler — toplam yükseklik sağ sütunla eşit -->
          <Col :xs="24" :xl="16" class="kp-dashboard__col">
            <div class="kp-dashboard__stack kp-dashboard__stack--charts">
              <Card
                class="kp-dash-card kp-dash-card--flex"
                title="Varlık trendi"
                :body-style="dashCardBody"
              >
                <template #extra>
                  <span class="kp-dash-card__meta">Son 90 gün</span>
                </template>
                <div class="kp-dash-chart">
                  <KpChart
                    :option="assetTrendOption"
                    :is-empty="!hasAssetTrend"
                    empty-message="Henüz varlık hareketi yok."
                    height="100%"
                  />
                </div>
              </Card>

              <Card
                class="kp-dash-card kp-dash-card--flex"
                title="Nakit akışı"
                :body-style="dashCardBody"
              >
                <template #extra>
                  <span class="kp-dash-card__meta">13 ay · gelir / gider / net</span>
                </template>
                <div class="kp-dash-chart">
                  <KpChart
                    :option="cashflowOption"
                    :is-empty="!hasCashflow"
                    empty-message="Bu aralıkta gelir veya gider kaydı yok."
                    height="100%"
                  />
                </div>
              </Card>
            </div>
          </Col>

          <!-- Sağ: yan panel — yükseklik referansı -->
          <Col :xs="24" :xl="8" class="kp-dashboard__col">
            <div class="kp-dashboard__stack kp-dashboard__stack--sidebar">
              <Card
                class="kp-dash-card kp-dash-card--compact"
                title="30 gün borç karşılama"
                :body-style="dashCardBody"
              >
                <div class="kp-dash-coverage">
                  <Progress
                    type="dashboard"
                    :percent="coveragePercent"
                    :width="120"
                    :status="data.debtCoverage30.canCover ? 'success' : 'exception'"
                    :format="(p) => `${p}%`"
                  />
                  <p class="kp-dash-coverage__text">
                    <template v-if="Number(data.debtCoverage30.debtDue) <= 0 && data.debtCoverage30.canCover">
                      Önümüzdeki 30 günde vadesi gelen taksit yok.
                    </template>
                    <template v-else-if="data.debtCoverage30.canCover">
                      Nakit + gelir − gider, önümüzdeki vadeleri karşılıyor.
                    </template>
                    <template v-else>
                      Tahmini açık
                      <strong>{{
                        formatCurrency(data.debtCoverage30.netSurplus, localCurrency)
                      }}</strong>
                    </template>
                  </p>
                </div>
              </Card>

              <Card
                class="kp-dash-card kp-dash-card--compact"
                title="Hesaplar"
                :body-style="dashCardBody"
              >
                <ul v-if="data.topAccounts.length" class="kp-dash-list">
                  <li
                    v-for="item in data.topAccounts"
                    :key="item.id"
                    class="kp-dash-list__row"
                  >
                    <span class="kp-dash-list__label">
                      <BankOutlined v-if="item.kind === 'account'" />
                      <WalletOutlined v-else />
                      <span class="kp-dash-list__name">{{ item.name }}</span>
                    </span>
                    <span :class="balanceClass(item.balance)">
                      {{ formatCurrency(item.balance, item.currency) }}
                    </span>
                  </li>
                </ul>
                <p v-else class="kp-dash-empty">Henüz hesap veya kasa yok.</p>
              </Card>

              <Card
                v-if="debtTypeStats.length"
                class="kp-dash-card kp-dash-card--compact"
                title="Borç özeti"
                :body-style="dashCardBody"
              >
                <ul class="kp-dash-list">
                  <li
                    v-for="item in debtTypeStats"
                    :key="item.key"
                    class="kp-dash-list__row"
                  >
                    <span class="kp-dash-list__label">
                      <span
                        class="kp-dash-list__dot"
                        :style="{ background: item.color }"
                      />
                      {{ item.label }}
                    </span>
                    <span class="kp-balance">{{
                      formatCurrency(item.value, localCurrency)
                    }}</span>
                  </li>
                </ul>
              </Card>

              <nav class="kp-dash-nav" aria-label="Hızlı erişim">
                <button
                  v-for="link in quickLinks"
                  :key="link.name"
                  type="button"
                  class="kp-dash-nav__item"
                  @click="go(link.name)"
                >
                  <component :is="link.icon" class="kp-dash-nav__icon" />
                  <span>{{ link.label }}</span>
                  <RightOutlined class="kp-dash-nav__arrow" />
                </button>
              </nav>
            </div>
          </Col>
        </Row>

        <!-- Alt: dağılım grafikleri -->
        <section class="kp-dashboard__breakdown">
          <h2 class="kp-dashboard__heading">Dağılım & vadeler</h2>
          <Row :gutter="[16, 16]">
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="kp-dash-card" title="Borç" :body-style="dashCardBody">
                <KpChart
                  :option="debtBreakdownOption"
                  :is-empty="!hasDebts"
                  empty-message="Aktif borç yok."
                  :height="220"
                />
              </Card>
            </Col>
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="kp-dash-card" title="Gelir" :body-style="dashCardBody">
                <template #extra>
                  <span class="kp-dash-card__meta">13 ay</span>
                </template>
                <KpChart
                  :option="incomeCategoryOption"
                  :is-empty="!hasIncomeCategories"
                  empty-message="Kategorize gelir yok."
                  :height="220"
                />
              </Card>
            </Col>
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="kp-dash-card" title="Gider" :body-style="dashCardBody">
                <template #extra>
                  <span class="kp-dash-card__meta">13 ay</span>
                </template>
                <KpChart
                  :option="expenseCategoryOption"
                  :is-empty="!hasExpenseCategories"
                  empty-message="Kategorize gider yok."
                  :height="220"
                />
              </Card>
            </Col>
            <Col :xs="24" :sm="12" :xl="6">
              <Card class="kp-dash-card" title="Yaklaşan vadeler" :body-style="dashCardBody">
                <template #extra>
                  <span class="kp-dash-card__meta">6 ay</span>
                </template>
                <KpChart
                  :option="upcomingDebtOption"
                  :is-empty="!hasUpcoming"
                  empty-message="Bilinen vade yok."
                  :height="220"
                />
              </Card>
            </Col>
          </Row>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kp-dashboard-page__notices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kp-dashboard-page :deep(.kp-page-header) {
  margin-top: 12px;
  margin-bottom: 20px;
}

.kp-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.kp-dashboard__stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kp-dashboard__main :deep(.ant-row) {
  align-items: stretch;
}

/* xl+: sol grafik yığını = sağ panel toplam yüksekliği */
@media (min-width: 1200px) {
  .kp-dashboard__col {
    display: flex;
    flex-direction: column;
  }

  .kp-dashboard__stack--charts,
  .kp-dashboard__stack--sidebar {
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  .kp-dashboard__stack--sidebar {
    justify-content: flex-start;
  }

  .kp-dash-card--flex {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .kp-dash-card--flex :deep(.ant-card-body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .kp-dash-chart {
    flex: 1;
    min-height: 0;
    height: auto;
  }
}

/* Mobil / tablet: sabit grafik yüksekliği */
@media (max-width: 1199px) {
  .kp-dash-chart {
    height: 260px;
  }

  .kp-dashboard__stack--charts .kp-dash-card:last-child .kp-dash-chart {
    height: 280px;
  }
}

.kp-dash-chart :deep(.kp-chart) {
  height: 100%;
}

.kp-dashboard__heading {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
}

.kp-dashboard__breakdown {
  padding-top: 20px;
  border-top: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
}

/* Kartlar */
.kp-dash-card :deep(.ant-card-head) {
  min-height: 44px;
  padding-inline: 16px;
  border-bottom: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
}

.kp-dash-card :deep(.ant-card-head-title) {
  font-size: 14px;
  font-weight: 600;
  padding-block: 10px;
}

.kp-dash-card :deep(.ant-card-extra) {
  padding-block: 10px;
}

.kp-dash-card__meta {
  font-size: 12px;
  font-weight: 400;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  white-space: nowrap;
}

/* Borç karşılama */
.kp-dash-coverage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-block: 4px;
}

.kp-dash-coverage__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
}

/* Kompakt liste */
.kp-dash-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kp-dash-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
}

.kp-dash-list__row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.kp-dash-list__row:first-child {
  padding-top: 0;
}

.kp-dash-list__label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
}

.kp-dash-list__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-dash-list__dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.kp-dash-empty {
  margin: 0;
  font-size: 13px;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
}

/* Hızlı erişim */
.kp-dash-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
}

.kp-dash-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  border-radius: var(--kp-radius, 8px);
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02));
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.kp-dash-nav__item:hover {
  background: var(--ant-color-fill-tertiary, rgba(0, 0, 0, 0.04));
  border-color: var(--ant-color-primary-border, #91caff);
}

.kp-dash-nav__icon {
  font-size: 15px;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
}

.kp-dash-nav__arrow {
  margin-inline-start: auto;
  font-size: 11px;
  opacity: 0.45;
}

@media (max-width: 1199px) {
  .kp-dash-nav {
    margin-top: 0;
  }
}

@media (max-width: 640px) {
  .kp-dashboard-page :deep(.kp-page-header) {
    margin-top: 8px;
    margin-bottom: 16px;
  }

  .kp-dashboard {
    gap: 20px;
  }

  .kp-dash-card__meta {
    display: none;
  }
}

[data-theme='dark'] .kp-dashboard__heading {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-dashboard__breakdown {
  border-top-color: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .kp-dash-card :deep(.ant-card-head) {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .kp-dash-card__meta {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-dash-coverage__text {
  color: rgba(255, 255, 255, 0.55);
}

[data-theme='dark'] .kp-dash-coverage__text strong {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-dash-list__row {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .kp-dash-list__label {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-dash-empty {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-dash-nav__item {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-dash-nav__item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(22, 119, 255, 0.35);
}

[data-theme='dark'] .kp-dash-nav__icon {
  color: rgba(255, 255, 255, 0.55);
}

[data-theme='dark'] .kp-dash-nav__arrow {
  color: rgba(255, 255, 255, 0.45);
  opacity: 1;
}
</style>
