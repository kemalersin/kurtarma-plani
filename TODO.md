# TODO

## Planlama (M0)

- [x] Türkiye bankacılık araştırması
- [x] Tech stack kararı (Vue 3 + PrimeVue)
- [x] models.dev araştırması
- [x] Kullanıcı netleştirmeleri (9 madde + hassas veri)
- [x] README, ARCHITECTURE, BANKING-TR
- [x] Cursor rules / SKILL
- [ ] **Onay:** Geliştirmeye (M1) geçiş

## M1 — İskelet

- [x] Vite + Vue 3 + Ant Design Vue 4 + hash router (Tailwind yok)
- [x] vite-plugin-singlefile production build (`dist/index.html` ~920 KB)
- [x] `<a-config-provider>` tema (light/dark algorithm) + `trTR` locale
- [x] AppShell (`a-layout-sider` collapse+pin, navbar+`a-input-search`, tema toggle)
- [x] Zorunlu yasal disclaimer bileşeni (modal + banner)
- [x] Profil kurulum / seçim / isteğe bağlı parola ekranı (PBKDF2-SHA256, 310k)
- [x] Bölgesel ayarlar (locale, currency, timezone, dateFormat) — varsayılan TR
- [x] Dexie meta DB (`appMeta`, `profiles`) + Pinia stores

## M2 — Veri katmanı

- [x] `bankingPreset` store + embed fallback + Zod şema
- [x] Çevrimiçi preset feed güncelleme (DB ezme) + manuel JSON import
- [x] `useConnectivity` (online/offline); AI ve preset feed gated
- [x] Dexie meta DB v2 (bankingPreset eklendi) + profil başına ayrı DB
- [x] Çoklu profil store izolasyonu (`kurtarma-plani.profile.<id>`)
- [x] AES-GCM data key + PBKDF2 wrap; parola ekle/değiştir/kaldırda re-encrypt
- [x] `sensitive` alanı `ProfileEntityRow` üzerinde (entity tipleri M3'te)
- [x] Export/import dialog (şifre, hassas, API keys seçenekleri)
- [x] Import Zod doğrulama + schemaVersion + şifreli/şifresiz dosya zarfı

## M3 — Yönetimsel veriler

- [x] Bankalar, hesaplar, kasalar
- [x] Gelir/gider türleri (parametrik)
- [x] Liste: sort, page, search, arşiv filtresi
- [x] Drawer formlar + combobox "Yeni Kayıt" stack (`useDrawerStack`)

## M4 — Kredi

- [x] Saf TS finans motoru (`src/finance/`): anüite, kalan bakiye, gecikme faizi, erken kapama
- [x] `decimal.js` (28 hane HALF_EVEN) + `date-fns` tarih
- [x] Vitest birim testleri (12 test geçti)
- [x] `Loan` + `LoanPayment` entity (Zod şema, profil DB type listesine eklendi)
- [x] Kredi CRUD + canlı taksit önizleme (`LoanFormDrawer`)
- [x] Aylık/yıllık faiz seçimi, gecikme faizi (default = sözleşme × 1.3)
- [x] Bankacılık preset'inden KKDF + BSMV doldurma
- [x] Taksit planı drawer + ödeme işaretleme (gerçek tarih/tutar/notlar)
- [x] Krediler listesi: kalan borç, aylık taksit, ilerleme, durum (Devam / Gecikmiş / Kapandı)
- [x] `/debts` sekmeli sayfa (Krediler aktif; Kart / Avans / Taksitli avans M5'te)

## M5 — Kart & avans

- [x] **Finans motoru:** `credit-card.ts` (tier asgari %20/%40, dönem özeti, gecikme projeksiyonu), `cash-advance.ts` (revolving ledger — kronolojik tahakkuk, ödeme önce faizi kapatır)
- [x] **Vitest:** 15 yeni test (toplam 27/27 geçti)
- [x] **Entity tipleri:** `CreditCard` + `CreditCardTransaction` (purchase/payment/cashAdvance), `CashAdvanceAccount` + `CashAdvanceTransaction` (draw/payment), `InstallmentCashAdvance` + `InstallmentCashAdvancePayment`
- [x] **Profil DB EntityType** listesi 4 yeni tip ile genişletildi
- [x] **Kredi kartı UI:** liste + form + hesap özeti drawer (dönem seçimi + hareket tablosu + asgari) + hareket drawer
- [x] **Nakit avans UI:** liste + form + ledger drawer (kalan anapara, işleyen faiz, toplam, kullanılabilir) + hareket drawer
- [x] **Taksitli nakit avans UI:** liste + form (bağlı nakit avans hesabı combobox, "Erken kapama faizsiz" bayrağı) + taksit planı drawer + ödeme drawer
- [x] **DebtsView** 3 sekme aktive edildi
- [x] Referans preset alanlarından "Referansla doldur": kartta limit tier'ına göre alışveriş/gecikme/nakit avans faizi; nakit avansta tavan oran; taksitli avansta tavan oran

## M6 — Gelir & gider

- [x] **Finans motoru:** `cashflow.ts` — `cashflowStatus` (realized/overdue/due/upcoming), `sumByDateRange` (`plan` / `actual` / `effective`), `computeDebtCoverage` (net karşılama + yüzde)
- [x] **Vitest:** 11 yeni test (toplam 41/41 geçti)
- [x] **Entity tipleri:** `Income`, `Expense` (hedef = hesap ⊕ kasa, Zod refine), `Transfer` (from/to her biri hesap ⊕ kasa; aynı varlığa engel)
- [x] **Profil DB EntityType:** `transfer` eklendi (`income`, `expense` mevcut)
- [x] **Bakiye yardımcıları:** `accountBalance` + `cashRegisterBalance` + `totalCashOnHand` (gerçekleşmiş hareketler)
- [x] **CashflowView** `/cashflow` (sekmeli `useRoutedTabs`); vade dikkat sayısı sekme başlığında `Badge` (DebtsView / AdminView ile tutarlı sade üst yerleşim)
- [x] **IncomesTab + IncomeFormDrawer**: anlık/planlı switch, hesap/kasa radio, tür/hesap stack drawer, satır-içi "Gerçekleşti" Popconfirm
- [x] **ExpensesTab + ExpenseFormDrawer**: aynı desen, kaynak = hesap/kasa
- [x] **TransfersTab + TransferFormDrawer**: kaynak/hedef her biri hesap ⊕ kasa (4 kombinasyon)
- [x] **Borç karşılama (temel):** `computeDebtCoverage` motorda hazır; M7 dashboard'unda derinleştirilecek
- [x] **EntityListPage extension:** `__` prefix'li sütunlar mobil kartlarda gizlenir (satır-içi tek-tık aksiyonlar için yeniden kullanılabilir desen)
- [x] **AppShell menü + breadcrumb:** Nakit akışı + `SwapOutlined`
- [x] **Borç ↔ nakit akışı bağlantısı (Yaklaşım A):** Tüm M4/M5 ödeme/hareket entity'lerine `source*` / `target*` hesap-kasa alanları; ortak `PaymentSourcePicker` bileşeni 4 drawer'a entegre; `movements.ts` kanonik akış toplayıcı; `balanceHelpers` refactor (tek `movements` parametresi); 9 yeni Vitest (50/50)

## M7 — Analiz & rapor

- [x] **M7.1 — Analiz motoru + Dashboard:** `src/features/analytics/` saf TS (`snapshot.ts` asset/debt/netWorth, `series.ts` cashflow/category/upcomingDebt, `useDashboardData.ts` reaktif composable); `KpChart.vue` ECharts wrapper (tree-shaken core + Canvas + Bar/Line/Pie + Grid/Legend/Title/Tooltip/DataZoom, responsive, tema-uyumlu); Panel (HomeView) 5 stat + 4 grafik (aylık nakit akışı / borç dağılımı / gider kategorileri / yaklaşan vadeler); 18 yeni Vitest (93/93)
- [x] **M7.2 — Analiz / rapor sayfası:** `/analytics` sekmeli (borç analizi, nakit akışı, hesap geçmişi); declarative filtreler (tarih aralığı, banka, hesap, kategori); tablo + grafik aynı sayfada; `reports.ts` + `useAnalyticsFilters` + 5 Vitest (98/98)
- [ ] **M7.3 — Export (UI only):** görünen tablo → Excel (`write-excel-file` ~40 KB); görünen tablo + grafik → PDF (tarayıcı print API + `@media print` özel CSS, 0 KB ek bağımlılık) — **ertelendi**

## M8 — AI

- [x] **models.dev build embed script** (`scripts/fetch-models-catalog.ts`; `bundled.json` + isteğe bağlı `generated.json`; `FETCH_MODELS=1 npm run build`; **UI'dan güncelleme** → IndexedDB `modelsCatalog`, gömülü listeyi ezer)
- [x] **Provider adapters + stream** (Anthropic, OpenAI, Gemini, DeepSeek, Ollama, vLLM; SSE stream + anlık token/maliyet)
- [x] **Sohbet kalıcılığı + usage ledger** (`chatSession`, `aiUsage` entity; sohbet temizlense bile usage kalır)
- [x] **Snapshot'tan hassas + secrets filtreleme** (`buildAiFinanceSnapshot`; AI ayarları/API anahtarları hariç)
- [x] **Sohbete görsel yükleme** (vision/multimodal; dosya + yapıştır; OpenAI/Anthropic/Gemini adapter)
- [x] **Sohbete dosya ekleri** (PDF, TXT, CSV, JSON + görseller; provider bazlı format)
- [x] **AI kayıt önerisi** (`kp-proposals` JSON → parse/resolve/apply; `AiProposalPanel`)

## M9 — Sertleştirme

- [x] Vitest finans motoru testleri (M4 ile geldi; kart/avans testleri M5+)
- [ ] E2E kritik akışlar
- [ ] Bundle boyutu optimizasyonu
