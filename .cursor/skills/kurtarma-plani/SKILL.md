---
name: kurtarma-plani
description: >-
  Kurtarma Planı statik SPA geliştirme: Vue 3, Ant Design Vue, IndexedDB, finans
  motoru, çoklu profil, şifreleme, AI sohbet. Proje dosyalarında veya finans/UI
  görevlerinde kullan.
---

# Kurtarma Planı — Geliştirici SKILL

## Proje özeti

Tek HTML statik SPA; borç/gelir/gider takibi; IndexedDB; opsiyonel parola şifrelemesi; çoklu profil.

## Geliştirici ve UI/UX yaklaşımı (Wiki §9–10)

**Mimari:** Modüler, kütüphane odaklı, tekrar kullanılabilir bileşenler; finans motoru UI'dan ayrık (`src/finance/` — saf TS, `decimal.js` + `date-fns`). Vue bileşenleri sadece sunum + form state.

**UX:** Sezgisel, sade yerleşim; mobile-first; açık/koyu tema; finans odaklı tipografi ve tutar vurgusu.

**UI kit:** Ant Design Vue 4 + `@ant-design/icons-vue`. **Tailwind kullanılmaz**; stil AntDV token + `<style scoped>` + minimal global CSS.

**Kabuk:** `<a-layout-sider>` (collapse + manuel pin), üst navbar `<a-input-search>` global arama, formlar **`FormDrawer`** (stack kaydırma + ilk alan focus).

**Etkileşim:** `<a-select>` `dropdownRender` slot'unda 「Yeni Kayıt」 → drawer stack (üstte yeni form). Liste: `EntityListPage` — masaüstü `<a-table>`, mobil (`≤640px`) kart; **satır/kart tıklama** ortak (`onListItemClick`: varsayılan `@edit`, `@row-click` tanımlı sayfalarda satır aksiyonu); araç çubuğu (arama + filtre ikonu · ortada arşiv · yeni kayıt; mobilde arşiv üstte ortada). Filtreler **popover** içinde (banka built-in `bank-filter` + `:banks`; diğerleri **declarative** `:filters="ListFilter<T>[]"` — `select` / `numberRange` / `dateRange`; rozet aktif filtre sayısı; 「Filtreyi temizle」 hepsini sıfırlar). Liste route'ları `meta.pageLayout: 'wide'` veya sekmeli listelerde `'wide-fill'`. **Renk:** `ColorPickerInput` (form), `ColorSwatch` (liste `color` sütunu). **Tooltip:** `KpTooltip` — `≤768px` tooltip yok; **liste sütunlarında tooltip yok** (sadece aksiyon ikonları). **Drawer:** `FormDrawer` — mobilde tam ekran; stack yatay kaydırma yok (`useMatchMedia` / `KP_MOBILE_VIEWPORT_MQ`). **Header `#extra`:** yalnız Vazgeç + Kaydet; **silme header'da yok** (form altı `.kp-form-drawer-danger-row` veya liste `TableRowActions`). **Drawer içi tablo:** ham `<Table>` değil `DrawerDataTable`; içerik `kp-drawer-table-page` ile kalan yüksekliği doldurur; `row-actions` + `@edit`/`@delete` (`TableRowActions`); taksit planı sütunları `buildScheduleDrawerColumns` (`schedule-table-columns.ts`).

**Liste URL state:** `useListQuery({ key })` — arama, arşiv, banka, sıralama, sayfa, sayfa boyutu + declarative filtreler URL query'de. `state-key` zorunlu (çoklu liste). **`:loading` birleşik:** sütun/filtrede kullanılan tüm entity store'ları `computed` ile birleştir; `onMounted` yüklemesi ile aynı küme. Güncel bakiye → `useAccountBalances().balanceMovementLoading`. Masaüstü layout oturtma `EntityListPage` içinde otomatik (`tableMeasurePending`). Ayrıntı: `ui-patterns.mdc` → Liste `:loading`, Masaüstü tablo layout oturtma.

**Liste filtre matrisi:** Borçlar → Krediler / Taksitli avans → banka + durum (active/overdue/closed) + anapara + **aylık taksit** + **kalan** + vade + başlangıç tarihi. Borçlar → Kredi kartları → banka + limit + borç + **kullanılabilir** + **asgari ödeme**. Borçlar → Nakit avans → banka + limit + anapara + **işleyen faiz** + **toplam borç** + **kullanılabilir**. Yönetim → Hesaplar → banka + tür + açılış. Yönetim → Kasalar → açılış. Yönetim → Bankalar / Gelir-Gider türleri → **Durum** = kullanım (used/unused) — başka entity'lerden referans alıyorsa "Kullanımda". Nakit akışı → Gelir/Gider → tür + hedef/kaynak + durum (`cashflowStatus`) + tutar + plan/gerçek tarih. Nakit akışı → Transfer → kaynak + hedef + tutar + tarih. **Türetilen değerler** (summary cache, formül üzerinden) doğrudan `getValue` callback ile filtreye geçirilir — listede sütun varsa filtre de olmalı. **Para birimi filtresi yok** (profil para birimi sabit). **Her listede en az bir filtre** olmalı (yoksa "Durum = kullanım" anlamlı bir varsayılan).

**Sayfa genişliği:** `resolvePageLayout()` (`src/router/meta.ts`); AppShell `.kp-page` / `.kp-page--wide` / `.kp-page--fill`. Liste dikey dolgu: `--kp-table-min-h` + `--kp-table-body-min-h`; taşan içerik `.kp-content` kaydırması (dahili `scroll.y` yok).

**Grafik:** ECharts dashboard + ayrı analiz/rapor sayfaları. Tüm grafikler **`KpChart.vue`** sarıcısından geçer — tree-shaken `echarts/core` + `CanvasRenderer` + `BarChart`/`LineChart`/`PieChart` + `Grid`/`Legend`/`Title`/`Tooltip`/`DataZoom` (yeni grafik tipi gerekirse `use([...])` listesine eklenir). Responsive `ResizeObserver`; tema değiştiğinde dispose + re-init (`useUiStore.isDark`); `isEmpty` durumu boş-mesaj overlay'iyle.

**Bölgesel:** `<a-config-provider :locale="trTR">`; profil `localeSettings` (Ayarlar → Bölgesel: locale, **para birimi**, timezone, tarih formatı). Para birimi formlarda değiştirilemez; `LocaleInputNumber` + `useLocaleFormatters`. Varsayılan tr-TR, TRY, Europe/Istanbul. AntDV içeride `dayjs`; finans `date-fns-tz`. **Görüntü formatlama:** her zaman `useLocaleFormatters()` (`formatCurrency`, `formatDate`, `formatDateLong`, `formatNumber`); ham `Intl.*Format` çağırma.

**Liste içinde satır-içi aksiyon:** `EntityListPage` `__` prefix'li sütun key'leri (`__actions`, `__realize`, …) mobil kartlarda otomatik gizler; masaüstü tablosunda `customRender: () => h(Popconfirm, …)` ile tek-tık aksiyon. Mobilde aynı aksiyon **form drawer** içinden (örn. `Switch`) sağlanmalı. Status sütunu mobil kart uyumu için **düz string** (Tag yerine — Tag istenirse yalnızca tabloda `h(Tag, …)`).

**Vade durumu (M6+):** Planlı gelir/gider/transfer için `cashflowStatus(item, asOf?)` → `realized` / `overdue` / `due` (7 gün) / `upcoming`. Hesap/kasa **gerçekleşmiş** bakiyesi için `accountBalance` / `cashRegisterBalance` / `totalCashOnHand` (`src/features/cashflow/balanceHelpers.ts`). Borç karşılama analizi: `computeDebtCoverage(...)`.

**Analitik motor (M7+, `src/features/analytics/`):** Saf TS, UI bağımsız. `snapshot.ts` → `assetSnapshot` / `debtSnapshot` / `netWorth` (asOf anlık pozisyon, currency-aware: dövizli hesap toplama dahil değil ama listede gözükür). `series.ts` → `monthlyCashflowSeries` (`plan|actual|effective` basis) / `incomeByType` + `expenseByType` (donut) / `assetTrendSeries` (90+ gün için 7'şer adım) / `upcomingDebtSeries`. `useDashboardData.ts` → reaktif composable, tüm gerekli store'ları paralel yükler. Yeni dashboard / analiz sayfaları **bu modüllerden** veri çeker; entity ham hesabı bileşende yapılmaz.

**Süreç:** Milestone sırası (TODO.md); her teslimatta CHANGELOG (`[Unreleased]`; `npm version` ile otomatik `[X.Y.Z]` taşınması); kural dosyaları `.cursor/rules/`.

Detay: `.cursor/rules/developer-ux.mdc` (alwaysApply).

## Okuma sırası

1. `docs/WIKI.md` (ilk gereksinimler — eksiksiz)
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/BANKING-TR.md` (referans preset açıklaması)
5. `TODO.md`

## Kritik iş kuralları

| Konu | Kural |
|------|--------|
| Profil | Her profil izole; ilk yüklemede seçim |
| Parola | Zorunlu değil; varsa tüm profil verisi şifreli |
| Hassas veri | `sensitive: true`; export onayı; AI'da yok |
| API keys | Export opsiyonel; AI'ya asla |
| Entity şeması | `entities.ts` / migration → aynı PR: `ai-context-export` (+ `AI_CONTEXT_VERSION`); gerekirse yedek/senkron (`export.ts`, `snapshot.ts`, `SCHEMA_VERSION` / `SYNC_SCHEMA_VERSION`) |
| TCMB preset | Build embed + IndexedDB; çevrimiçi feed/import ile DB ezme; offline'da DB/embed |
| Çevrimiçi | Finans offline-first; AI + preset feed yalnızca online |
| AI | models.dev embed; stream; usage kalıcı; offline'da devre dışı; kayıt önerisi `kp-proposals` (`src/features/ai/proposals/prompt.ts`) |
| Rapor | Excel/PDF UI export only |

## Build

```bash
npm run build
FETCH_MODELS=1 npm run build
```

## Milestone sırası

M1 iskelet → M2 veri → M3 yönetimsel → M4–M5 borç → M6 akış → M7 analiz → M8 AI → M9 test

Yeni özellik eklerken `TODO.md` ve `CHANGELOG.md` güncelle (`[Unreleased]`). Yayın: `npm version patch` (veya `minor` / `major` / `X.Y.Z`) — CHANGELOG taşıması otomatik; ardından `main` push. Bkz. README § Sürüm ve CHANGELOG.

## Finans motoru (`src/finance/`)

- `decimal.js` — 28 hane, HALF_EVEN; `D()`, `roundMoney()`, `moneyEquals()` helper'ları
- `rates.ts` — `toMonthly({ value, period })`, `toDailyFromMonthly()`, `annualEffectiveFromMonthly()`
- `loan.ts` — `buildAnnuitySchedule(input)` (anüite + son taksitte yuvarlama kapanışı), `computeLateFee()` (default = sözleşme × 1.3, basit günlük), `payoffAmount()` (kalan anapara + kısmi ay faizi), `lateDays()`
- `credit-card.ts` — `creditCardMinPaymentRate(limit, tiers?)` (TR: <25k %20 / ≥25k %40), `creditCardStatement({ openingBalance, transactions, limit })` (dönem sonu + asgari ödeme), `creditCardLateInterest({ unpaidBalance, daysLate, apr, lateApr? })` (default `apr × 1.087`)
- `cash-advance.ts` — `runRevolvingLedger({ openingBalance, openingDate, transactions, apr, asOf? })`: kronolojik hareketler arasında günlük basit faiz tahakkuku; ödeme önce tahakkuk eden faizi sonra anaparayı düşer; aşırı ödeme sıfırla sınırlanır
- KKDF + BSMV: `taxRateMonthly` faize gömülür (`i_eff = i · (1 + tax)`); preset'ten alınır
- `npm run test` — Vitest birim testleri (toplam 98 test: M4 kredi + M5 kart/revolving + M6 cashflow + bakiye + datepicker + analytics + helper'lar)

## Analiz / rapor sayfası (M7.2)

- `/analytics` route — `pageLayout: 'wide'`; sekmeler URL'de (`?tab=debts|cashflow|accounts`)
- Filtreler URL'de: `from`, `to`, `bank`, `endpoint` (`acc:<id>` / `reg:<id>`), `category` (nakit akışı sekmesi)
- **`reports.ts`:** `debtInstallmentRows`, `cashflowMonthRows`, `movementRows`, `filterCashflowRecords`
- **`useAnalyticsFilters` / `useAnalyticsData`:** filtre senkron + store yükleme
- Her sekme: `KpChart` + `Table` — borç (stacked bar + taksit listesi), nakit akışı (bar/line + donut + aylık tablo), hesap geçmişi (trend + hareket listesi)

## Form sayısal alan kuralı

- **Hiçbir form `<a-input-number>` doğrudan kullanmaz.** Daima `<LocaleInputNumber kind="currency|percent|integer" />`
  - `currency` — profil locale ondalık ayracı + `Intl.NumberFormat` currency hane sayısı (TRY için 2)
  - `percent` — profil locale'inin yüzde max hane sayısı
  - `integer` — `precision=0`, `step=1`
  - Space.Compact içinde kullanırken `style="flex: 1; min-width: 0"`
- **Para birimi Select'i form'da yer almaz.** Yeni kayıtlarda `currency: profileCurrency()` (sabit profil para birimi); mevcut kayıtlar düzenlemede kendi `currency` değerini korur (geri uyumluluk için `props.entity?.currency ?? profileCurrency()`)
- **`<a-select>`** çoklu seçenek listeleri **`:options="..."` array biçiminde** (slot'lu `<a-select-option>` döngüsü yerine)
- Gösterimde `useLocaleFormatters().formatCurrency / formatDate / formatNumber` — hardcoded `'tr-TR'` veya `Intl.NumberFormat` doğrudan kullanılmaz

## Borç sayfası

- `/debts` route — `pageLayout: 'wide'`; sekmeler URL'de (`?tab=loans|creditCards|cashAdvance|installmentAdvance`)
- `DebtsView` AdminView ile aynı **flex column** kalıbı (`kp-debts` + `kp-debts-tabs`); sekme panelleri `<div class="kp-list-tab-pane">` ile sarılı
- **Tüm 4 sekme aktif** (Krediler, Kredi kartları, Nakit avans, Taksitli nakit avans)
- **Satır tıklaması → detay drawer** (kredi: taksit planı, kart: dönem özeti, nakit avans: ledger, taksitli avans: taksit planı); **kalem ikonu → form drawer**. `EntityListPage` `@row-click` listener'ı varken `@edit` varsayılanını geçersiz kılar
- Tüm listelerde: `adminPrimaryNameColumn('<Tip>')` (otomatik genişlik + ellipsis); status sütunu **string** veya `kpTag` (`EntityListPage` / `KpColumnTagCell`); sütunlara elle `width` / `minWidth` verme — `prepareListTableColumns`
- Form drawer'larda **"Referansla doldur"** düğmesi:
  - Kredi: KKDF + BSMV alanı
  - Kredi kartı: limit tier'ına göre `purchase + late + cashAdvance` aylık oranları
  - Nakit avans: `cashAdvanceAprMonthly + cashAdvanceLateAprMonthly`
  - Taksitli avans: `cashAdvance.monthlyAprCeiling`
- **Detay drawer bilgi alert'leri:** `DismissibleDrawerAlert` + `hint-key` (taksit planı, erken kapama, ekstre, nakit avans ledger)
- **İşlem (transaction) drawer'ları:** Kart için `CreditCardTxnDrawer` (purchase/payment/cashAdvance), nakit avans için `CashAdvanceTxnDrawer` (draw/payment), taksitli avans için `InstallmentAdvancePaymentDrawer` (gecikme faizi form ipuçları)
- **Bağlı hesap stack drawer:** `InstallmentAdvanceFormDrawer` içinde `SelectWithCreate` ile "Yeni nakit avans hesabı" üst drawer olarak açılabilir

## TCMB preset (implementasyon)

```
readPreset():  db.bankingPreset.getActive() ?? bundledDefault
updateFromFeed(): require online → fetch → zod.parse → db.put (overwrite)
updateFromFile(): FileReader → zod.parse → db.put (overwrite)
```

Feed URL: varsayılan uygulama config'inde; ayarlardan override edilebilir.

## Çevrimiçi kontrolü

```typescript
// useConnectivity: navigator.onLine + optional HEAD probe
// AI routes/components: v-if="isOnline" veya disabled + tooltip
```

Preset güncelleme butonu offline'da disabled. AI adapter'ları `if (!isOnline) return` guard.
