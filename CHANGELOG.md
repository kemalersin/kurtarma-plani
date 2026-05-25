# Changelog

Format [Keep a Changelog](https://keepachangelog.com/) esasına uygundur.

## [Unreleased]

### Changed — tablo sütun genişliği

- Liste, drawer ve analiz tablolarında sütun genişliği otomatik (`table-layout: auto`, `scroll.x: max-content`); elle `width` / `minWidth` ve 112px / 280px varsayılanları kaldırıldı. **İstisna:** `__actions` sütunu 88px (2 düğme) / 132px (3 düğme).

### Changed — güncelleme bildirimi

- «Yeni sürüm mevcut» uyarısı ve **Hakkında** ekranındaki **index.html indir** düğmesi `index.html` dosyasını doğrudan indirir; başarısız olursa ham URL yeni sekmede açılır.

### Added — ilk açılış onboarding

- Profil yokken kurulumdan önce çok adımlı tanıtım (`#/onboarding`): yerel veri, senkron, AI asistan, yasal uyarı; ilerleme çubuğu ve adım geçişleri; tamamlanınca `localStorage` ile bir kez gösterilmez.

### Fixed — onboarding önceliği

- Tanıtım tamamlanmamışsa profil/kurulum yapılmış olsa bile `#/onboarding` gösterilir; bitince profil varsa seçim veya ana sayfaya, yoksa kuruluma yönlendirilir.
- Profil varken «Kuruluma atla/başla» yerine «Devam et» / «Uygulamaya geç»; son adım metinleri kurulum odaklı değil.

### Removed — AI bağlam YAML

- YAML dışa aktarım ve `js-yaml` bağımlılığı kaldırıldı; JSON + Markdown yeterli.

### Added — AI bağlam dışa aktarımı

- Navbar'da **AI dışa aktar** düğmesi: JSON ve Markdown formatında önizleme + indirme.
- Çıktı restore snapshot değil; semantik özet, çözülmüş etiketler, kredi/taksitli avans taksit planları.
- Kalan borç: ödenmemiş taksitler + biriken gecikme faizi ayrımı; vadesi geçmiş ve geç ödenmiş taksit sayıları.
- JSON: yalnızca ödenmemiş taksit satırları; önizlemede JSON renklendirme, Markdown biçimlendirme, **Kopyala**.
- Varsayılan: arşiv ve hassas kayıtlar hariç; API anahtarı ve sohbet verisi asla dahil edilmez.

### Changed — banka hesabı seçimi

- Banka hesabı combobox'ları banka adına göre gruplu; arama hesap ve banka adında çalışır (gelir/gider, transfer, borç ödemesi, analiz filtresi).

### Changed — kalan borç (taksit planı)

- Kalan borç = ödenmemiş taksit tutarları toplamı + vadesi geçmiş taksitler için biriken gecikme faizi (kredi, taksitli avans plan drawer ve listeler).
- Erken kapama tahmini gecikmiş taksitlerde vadesi geçmiş dönem faizi + biriken gecikme faizini de içerir.

### Added — erken kapama (taksit planı)

- Kredi ve taksitli nakit avans taksit planı drawer'ında **Erken kapama** düğmesi; tahmini tutar, ödeme tarihi ve kaynak hesap/kasa ile kalan taksitleri tek seferde kapatma.

### Added — yinelenen gelir/gider

- Gelir ve gider formlarında **Yinelenen** seçeneği (günlük / haftalık / aylık / yıllık); plan tarihi ilk yinelenme.
- Yinelenen kayıtlar otomatik **gerçekleşmiş** sayılır; bakiye, panel grafikleri ve borç karşılama projeksiyonunda genişletilir.
- Borç karşılama vadeleri kredi + taksitli avans + kredi kartı asgari ödemesini kapsar.

### Added — gömülü favicon

- Sekme ikonu SVG data URI olarak koda gömülü; `file://` ve tek dosya build'de harici favicon dosyası gerekmez.

### Fixed — profil parolası

- Parolasız profilde «Parola ekle» kayıtlar zaten AES ile şifreliyken `reencryptAll(null, …)` hatası veriyordu; yalnızca düz kayıtlar varsa yeniden şifreleme yapılır.

### Added — otomatik senkron (M10 S5)

- **Manuel fallback modu** (`syncMode: 'manual'`): Safari ve FS Access olmayan ortamlarda senkron açılabilir.
- Push → `.sync` dosyası indirilir; kullanıcı iCloud/Dropbox klasöründe üzerine yazar.
- Pull → «Güncel dosyayı seç» ile uzak dosya okunur; çakışma ve profil uyumsuzluğu handle modu ile aynı.
- Otomatik push/pull yalnızca handle modunda; manuel modda «Yerel sürümü indir» / «Güncel dosyayı seç» düğmeleri.

### Changed — güncelleme kontrolü

- Sürüm kontrolü yalnızca GitHub **package.json** `version` alanına bakar (release / commit API kaldırıldı).

### Changed — Ayarlar sekmeleri

- **Veri:** yalnızca yedek / içe aktarma.
- **Senkron** ve **Sürüm kontrolü** ayrı sekmeler (Veri'den sonra); navbar senkron rozeti Senkron sekmesine gider.

- Çevrimdışıyken otomatik veya manuel sürüm kontrolü **yapılmaz**.
- Güncelleme linkleri GitHub **dist/** klasörüne yönlendirilir; `dist/` repoda commit edilir.

### Fixed — GitHub sürüm kontrolü

- Aynı semver'de yalnızca sürüm numarasına bakılıyordu; artık **main branch son commit tarihi** ile `APP_BUILD_DATE` karşılaştırılır.
- «Şimdi kontrol et» dismissed / çevrimdışı durumlarında yanlış «güncel» mesajı göstermez.
- Kapatılan güncelleme bildirimi «Şimdi kontrol et» ile yeniden açılabilir.
- «Şimdi kontrol et» kapatılmış bildirimi yeniden açar; bildirim üstte sabit konumda.
- GitHub release API hata/rate limit durumunda **package.json** yedek yoluna düşer (403 artık bloklamaz).

### Added — GitHub sürüm kontrolü

- Sayfa yenilendiğinde (ayar açıksa) GitHub release veya `main` branch `package.json` sürümü kontrol edilir.
- Yeni sürüm varsa üst bilgi bandı; Ayarlar → **Sürüm kontrolü** ile otomatik kontrol kapatılabilir veya manuel kontrol yapılabilir.

### Added — Hakkında sayfası

- Sol menüde Ayarlar altında **Hakkında**; sürüm, özellik özeti, yasal uyarı ve [GitHub deposu](https://github.com/kemalersin/kurtarma-plani) bağlantısı.

### Fixed — otomatik senkron pull ve boş veri

- **Bootstrap pull:** Sayfa açılışında entity'ler yüklenmeden önce uzak dosya kontrol edilir (boş liste race'i giderildi).
- **Periyodik pull:** Açık sekmede ~45 sn'de bir uzak dosya okunur (iCloud/Dropbox gecikmesi).
- **Focus pull:** Pencere odağına dönünce uzak kontrol.
- **UI yenileme:** Uzak pull sonrası aktif sayfa yeniden yüklenir (`pullRevision`).

### Fixed — otomatik senkron sayfa yenilemede kapanması

- **Race düzeltmesi:** Profil açılırken senkron ayarları henüz yüklenmeden `saveConfig` çağrılıyor ve `enabled: false` yazılıyordu.
- Router ve App başlangıcında **senkron store profilden önce** yüklenir; `saveConfig` kalıcı meta ile birleştirir.
- Senkron seçenek checkbox'ları store yüklenene kadar gösterilmez; varsayılan `encryptFile: true` flicker'ı giderildi.

### Added — Kurulumda yedek / senkron geri yükleme

- **Kurulum** sekmesi: «Yedekten / senkron'dan geri yükle» — `.json` yedek veya `.sync` dosyası; profil kimliği (UUID) korunur.
- **`ProfileRestorePanel`:** Profil seçim ekranından da erişilebilir; senkron dosyası seçiminde handle otomatik kaydedilir (desteklenen tarayıcılar).
- **`profile-restore` servisi:** Ortak içe aktarma mantığı.

### Fixed — içe aktarma ve cihazlar arası senkron kimliği

- Yedek içe aktarımından sonra **içe aktarılan profil otomatik açılır** (yanlış profille senkron hatası önlenir).
- Aynı profil kimliği zaten varsa yeni kimlik üretmek yerine **mevcut profil güncellenir**.
- «Aktif profilin üzerine yaz» için senkron uyarısı eklendi (yerel kimlik korunur, dosya eşleşmeyebilir).

### Fixed — M10 çoklu profil senkron karışması

- Senkron dosya handle'ı artık **profil başına** IndexedDB'de saklanır (önceden tüm profiller tek handle paylaşıyordu).
- Profil değiştirildiğinde ilgili profilin dosyası yüklenir; diğer profile ait dosya yanlışlıkla eşleştirilmez.
- `fileNameByProfile` ile dosya adları profil bazında tutulur.

### Fixed — M10 senkron profil uyuşmazlığı

- Senkron dosyasındaki profil kimliği aktif profilden farklıysa artık kalıcı hata yerine **profil uyuşmazlığı** durumu gösterilir.
- **«Bu profile aktar ve bağla»:** Dosyadaki veriyi mevcut profile içe aktarır ve dosya meta verisini günceller (yeni cihaz / profil yeniden oluşturma senaryosu).

### Added — M10 Otomatik senkron (S4)

- **`SyncConflictModal`:** Uzak / yerel / vazgeç seçenekleri; şifreli dosya parolası; yerel kayıp uyarısı.
- **`SyncStatusBadge`:** Navbar senkron rozeti (güncel, yazma bekliyor, uzak güncelleme, çakışma, hata); çakışmada modal, diğer durumlarda Ayarlar → Veri.
- **`useSyncStore`:** `resolveConflictUseRemote`, `resolveConflictKeepLocal`, `conflictContext`; çakışma algılandığında modal otomatik açılır.

### Added — M10 Otomatik senkron (S3)

- **`sync-scheduler.ts`:** Kayıt sonrası 2 sn debounced push; `visibilitychange` ile otomatik pull; profil kilidi öncesi flush.
- **`sync-conflict.ts`:** Yerel/uzak değişiklik ayrımı; çakışmada otomatik pull atlanır (S4 modal öncesi).
- **`entities` hook:** `save` / `remove` sonrası `notifySyncLocalChange`.
- **Oturum parolası:** Manuel senkron sonrası `sessionStorage` ile otomatik push için parola hatırlama.
- **Durum:** `pending_push`, `remote_pending`, `conflict` runtime durumları.

### Added — M10 Otomatik senkron (S2)

- **`src/core/services/sync/`:** `sync-crypto`, `sync-envelope` (KP-SYNC1 build/parse + SHA-256), `sync-handle-store`, `sync-file` (File System Access okuma/yazma), `sync-engine` (manuel pull → push).
- **Meta DB v5:** `syncHandles` tablosu — seçilen senkron dosyası handle'ı IndexedDB'de kalıcı.
- **`useSyncStore`:** `pickFile`, `createFile`, `runManualSync`, `hasHandle`, `syncing`; revizyon takibi (`remoteRevisionByProfile`).
- **Ayarlar → Veri → Otomatik senkron:** «Dosya seç» / «Yeni dosya», «Şimdi senkronize et»; uzak revizyon farkında onaylı pull; şifreli dosya için parola modalı.

### Added — M10 Otomatik senkron (S1)

- **`SyncConfig` + `KP-SYNC1` zarf tipleri** (`src/core/types/sync.ts`) ve Vitest doğrulama.
- **Meta DB v4:** `AppMeta.deviceId` + `AppMeta.sync`; cihaz kimliği otomatik üretilir.
- **`useSyncStore`:** Senkron ayarlarını IndexedDB meta'da kalıcı tutar (I/O henüz yok).
- **Ayarlar → Veri → Otomatik senkron:** Açılıp kapatılabilir toggle; şifreleme, hassas/AI dahil etme ve otomatik yazma tercihleri.

### Added — M8 AI asistan

- **AI sohbet görsel desteği:** Composer'dan ekran görüntüsü yükleme (dosya seçici, yapıştırma); önizleme ve kaldırma; kullanıcı balonunda görüntüleme. OpenAI uyumlu, Anthropic ve Gemini sağlayıcıları multimodal API formatına uyarlanır. Görseller finans snapshot'ına dahil edilmez.
- **AI sohbet dosya ekleri:** PDF, TXT, CSV, JSON + görseller; metin dosyaları tüm sağlayıcılarda, PDF Anthropic/Gemini'de native; ataç simgesi ile yükleme.
- **AI kayıt önerisi (`kp-proposals`):** Asistan yanıtlarında DB uyumlu JSON blokları; tüm finans entity tipleri; ref/bankName ile ilişki çözümleme; sohbet balonunda «Kayıtları ekle» ile IndexedDB'ye yazma.
- **Görsel sağlayıcı uyumu:** Ollama görsel mesajları yerel `/api/chat` + `images[]` formatına taşındı; DeepSeek/vLLM için görsel ön kontrol ve Türkçe hata mesajı.
- **AI CORS (geliştirme):** Vite dev proxy (`/kp-ai-proxy/*`) — Anthropic, OpenAI, Gemini, DeepSeek istekleri localhost'tan CORS'suz gider; kayıtlı varsayılan bulut URL'leri dev'de otomatik proxy'ye yönlendirilir.
- **Anthropic tarayıcı erişimi:** `anthropic-dangerous-direct-browser-access: true` header'ı eklendi (CORS zorunluluğu).

- **`scripts/fetch-models-catalog.ts`:** Build sırasında [models.dev](https://models.dev) kataloğundan Anthropic, OpenAI, Gemini, DeepSeek modellerini çeker; `src/data/models-catalog/bundled.json` (fallback) + isteğe bağlı `generated.json` (`FETCH_MODELS=1`).
- **Model kataloğu IndexedDB:** Meta DB `modelsCatalog` store; okuma önceliği IndexedDB > gömülü katalog. Ayarlar → AI → «Kataloğu güncelle» (çevrimiçi, models.dev); «Gömülüye sıfırla».
- **Provider adapter'ları:** SSE stream — Anthropic Messages, OpenAI uyumlu (OpenAI, DeepSeek, Ollama, vLLM), Gemini `streamGenerateContent`; anlık token + USD maliyet (`models.dev` 1M token fiyatları).
- **Kalıcılık:** `chatSession` (aktif sohbet, sayfa yenilemede devam) + `aiUsage` ledger (sohbet temizlense bile kalır); `aiSettings` profil DB'de.
- **AI snapshot:** `buildAiFinanceSnapshot` — hassas kayıtlar, `aiSettings`/`aiUsage`/`chatSession` ve gizli alanlar (apiKey vb.) sistem promptuna dahil edilmez.
- **UI:** `/ai` sohbet sayfası (çevrimdışı devre dışı + açıklama); Ayarlar → AI sekmesi (sağlayıcı CRUD, model seçimi, Ollama/vLLM uzak model listesi, kullanım tablosu); sol menü «AI Asistan».
- **7 yeni Vitest** (`cost.spec.ts`) — toplam 107/107.
- **2 yeni Vitest** (`catalog-extract.spec.ts`) — toplam 109/109.

### Deferred — M7.3 Export (UI)

- Excel/PDF export ertelendi; M9 veya ayrı iterasyonda ele alınacak.


- **`/analytics` route** (`pageLayout: 'wide'`) — sekmeli sayfa: Borç analizi, Nakit akışı, Hesap geçmişi; URL'de `?tab=` + filtreler (`from`, `to`, `bank`, `endpoint`, `category`).
- **`reports.ts`:** Saf TS rapor sorguları — `debtInstallmentRows`, `cashflowMonthRows`, `movementRows`, `debtInstallmentMonthlySeries`, `filterCashflowRecords`, `categoryOptions`.
- **`useAnalyticsFilters` / `useAnalyticsData`:** URL senkron filtreler + entity yükleme composable'ları.
- **`AnalyticsFilterBar`:** Tarih aralığı, banka, hesap/kasa, kategori (nakit akışı sekmesinde) filtreleri.
- **Sekme bileşenleri:** Her sekmede grafik + tablo — borç vadeleri (stacked bar + taksit listesi), nakit akışı (bar/line + donut + aylık tablo), hesap geçmişi (bakiye trendi + hareket listesi).
- **Menü:** Sol menüde «Analiz & rapor» (`LineChartOutlined`); breadcrumb güncellendi.
- **5 yeni Vitest** (`reports.spec.ts`) — toplam 98/98.

### Changed — Bildirim (notice) yapısı

- **`KpNotice.vue`:** AntDV `Alert` banner yerine kompakt, kart benzeri bildirim — ikon + başlık + isteğe bağlı detay + inline aksiyon + sağ üst kapat. `info` / `warning` / `error` / `legal` tonları; AntDV token renkleri; mobil uyumlu.
- **`AppDisclaimer`:** `KpNotice` (`legal`) ile yeniden yapılandırıldı — tam genişlik banner kaldırıldı.
- **Panel uyarıları:** Eksiye düşen bakiye ve gecikmiş nakit akışı `kp-dashboard__notices` bölümünde gruplandı; her biri `KpNotice` + alt satırda aksiyon düğmesi.

### Changed — Dövizli hesap tutarlarında doğru para birimi simgesi

- **Panel → En yüksek bakiyeli hesaplar:** Bakiyeler artık hesap/kasanın kendi `currency` koduna göre formatlanır (USD hesapta ₺ yerine $).
- **`assetSnapshot` / `useDashboardData`:** `perAccount`, `perRegister` ve `topAccounts` kayıtlarına `currency` alanı eklendi.
- **Hesaplar / Kasalar listesi (mobil kart):** `EntityListPage` `kpDisplay` desteği — bakiye sütunları mobilde de doğru para birimiyle gösterilir.
- **AccountsTab / CashRegistersTab:** `useLocaleFormatters` ile tutarlı formatlama.

### Changed — Panel (Dashboard) genişletildi

- **`AppDisclaimer`:** Üst banner artık kapatılabilir (`closable` + `localStorage` `kp.disclaimerBannerDismissed.v1`); kısa mesaj _"Bu uygulama yalnızca bilgilendirme ve kişisel planlama amaçlıdır."_ + açıklama; «Detay» ile tam yasal modal açılır. Panel'de en üstte gösterilir.
- **`/home` route:** `pageLayout: 'wide'` — panel tam genişlikte.
- **Panel içeriği zenginleştirildi:** 8 özet metrik (2 satır: finansal özet + borç karşılama / ortalamalar / vade dikkati); varlık trendi (90 gün line+area); 30 gün borç karşılama gauge (`computeDebtCoverage`); gelir kategorileri donut; gecikmiş nakit akışı uyarısı + hızlı link; en yüksek bakiyeli hesap/kasa listesi; borç türleri dökümü; hızlı erişim (Borçlar / Nakit akışı / Yönetim).
- **`useDashboardData`:** `assetTrend`, `debtCoverage30`, `cashflowAttention`, `currentMonth`, `topAccounts` alanları eklendi.

### Added — M7.1: Analiz motoru + Dashboard (Panel) [ECharts]

- **Yeni modül `src/features/analytics/`** (saf TS, Vue bağımsız) — UI'dan ayrık analitik motor.
  - `snapshot.ts`: `assetSnapshot` (hesap + kasa toplamı; dövizli olanı toplama almaz, listede gösterir), `debtSnapshot` (kredi anüite kalan + kart `endingBalance` + KMH revolving `total` + taksitli avans kalan + overdue sayısı + donut breakdown), `netWorth` (varlık − borç + ratio).
  - `series.ts`: `monthlyCashflowSeries` (`plan` / `actual` / `effective` basis), `incomeByType` / `expenseByType` (donut için), `assetTrendSeries` (günlük kümülatif bakiye — 90+ gün için 7'şer adım), `upcomingDebtSeries` (ileriye doğru aylık vade toplamı).
  - `useDashboardData.ts`: tüm gerekli store'ları (`account`, `cashRegister`, `income`, `expense`, `loan`/`loanPayment`, `creditCard`/`creditCardTransaction`, `cashAdvanceAccount`/`cashAdvanceTransaction`, `installmentCashAdvance`/`installmentCashAdvancePayment`, `transfer`, `incomeType`, `expenseType`) paralel yükler, snapshot + serileri reaktif birleştirir, `localCurrency` farkındalığı.
- **`src/components/KpChart.vue`** — ECharts ortak sarıcı: **tree-shaken** core (`echarts/core` + `CanvasRenderer` + `BarChart` / `LineChart` / `PieChart` + `Grid` / `Legend` / `Title` / `Tooltip` / `DataZoom`); `ResizeObserver` ile responsive resize; `useUiStore.isDark` izleyip tema değişimde re-init; `isEmpty` durumunda boş-mesaj overlay (dispose + re-init).
- **`HomeView` (Panel) yenilendi**: `PageHeader` + `KpStatRow` (Toplam varlık / Toplam borç + vade dikkati / Net varlık + borç-varlık oranı / 6 aylık ort. gelir / 6 aylık ort. gider) + 4 grafik:
  1. **Aylık nakit akışı (13 ay)** — Bar (gelir/gider) + Line (net).
  2. **Borç dağılımı** — Pie (kredi / kart / KMH / taksitli avans).
  3. **Gider kategorileri (13 ay)** — Pie (`expenseByType`).
  4. **Yaklaşan borç vadeleri (6 ay)** — Bar (`upcomingDebtSeries`).
- Boş durumlar her grafik için açıklayıcı mesajla geçilir; hesap bakiyesi eksiye düşmüşse üstte uyarı `Alert`.
- **Bağımlılık:** `echarts@5.x`; build artışı ~620 KB (gzip ~190 KB). M9 bundle optimizasyonunda izlenecek.
- **Vitest:** 18 yeni test (`series.spec.ts` + `snapshot.spec.ts`) — `monthsBetween`, `monthlyCashflowSeries` (3 basis), kategori breakdown, vade serisi, asset/debt snapshot currency filtreleri, netWorth. **Toplam 93/93 geçti.**

### Changed — Drawer içi tablolar (liste kuralları)

- **`PaymentSourcePicker`:** `account` ve `cashRegister` koleksiyonları drawer açılmadan önce yüklenir — kredi kartı / nakit avans / taksitli avans / kredi ödeme formlarında hesap-kasa listesi boş kalma sorunu giderildi.
- **Drawer header silme yasağı:** `CreditCardTxnDrawer` / `CashAdvanceTxnDrawer` — `Sil` header'dan kaldırıldı; form altı + `Popconfirm` (`PaymentMarkDrawer` ile aynı desen). Ortak `.kp-form-drawer-danger-row` (`app.css`); `ui-patterns.mdc` + SKILL güncellendi.
- **Borç hareketi kaynağı — döviz kilidi:** `PaymentSourcePicker` içinden «Yeni hesap/kasa» yalnız profil para biriminde oluşturulur (`lockCurrency`); dövizli kayıt otomatik seçilemez; uyumsuz mevcut seçim temizlenir.
- **Kredi kartı dönem hareketleri:** `buildCardPeriods` artık **açık (güncel) hesap dönemini** içerir — kesim tarihinden sonra eklenen hareketler listede görünür; `creditCardTransaction` drawer açılışında yüklenir.
- **Drawer tablo satır aksiyonları:** `row-actions` + `TableRowActions` (düzenle / sil ikonları, liste ile aynı); kredi/taksitli avans planı, nakit avans ve kredi kartı hareket drawer'larına bağlandı.
- **`DrawerDataTable` boş durum:** liste sayfaları gibi ortalanmış `<Empty>` overlay (`emptyText` prop); AntDV placeholder gizli — boş drawer tablosunda beyaz boşluk sorunu giderildi.
- **`DrawerDataTable`**: drawer içindeki `<Table>` kullanımı tek sarmalayıcıda toplandı — `prepareListTableColumns`, `table-layout: fixed`, `:show-sorter-tooltip="false"`, başlık `nowrap`, `ant-table-cell-scrollbar` gizli. **`scroll.x` yalnızca sütun minimumları konteynere sığmıyorsa** (gereksiz yatay scrollbar önlenir); gövde varsayılan `overflow-x: hidden`. **Dikey dolgu:** `fillHeight` + `ResizeObserver` ile kalan alan; `kp-drawer-table-page` layout; sabit `calc(100dvh - …)` kaldırıldı.
- **Taksit planı sütunları**: `buildScheduleDrawerColumns` (`schedule-table-columns.ts`) — kredi ve taksitli nakit avans plan drawer'ları paylaşımlı sütun tanımı.
- **Güncellenen drawer'lar**: `LoanScheduleDrawer`, `InstallmentAdvanceScheduleDrawer`, `CashAdvanceLedgerDrawer`, `CreditCardStatementDrawer` (gereksiz `archived` sütunu kaldırıldı).
- **`ui-patterns.mdc`**: drawer içi tablo kuralı eklendi.

### Changed — Döviz kuru input görselleştirme + precision

- **`TransferFormDrawer` kur alanı**: yön kafa karışıklığını ortadan kaldırmak için input artık `addonBefore` / `addonAfter` ile görselleştirilir → **`1 USD = [____] TRY`**. Label sadeleşti (sadece "Döviz kuru"); addonlar `baseCurrency` ve `quoteCurrency`'yi gözle görür şekilde gösterir.
- **Precision 6 → 4**: TCMB pratiği ile uyumlu (örn. `33,2456`); 6 hane gereksiz yere uzundu.
- **`LocaleInputNumber`**: tüm `$slots`'ı altta `InputNumber`'a yönlendiren _slot forwarding_ eklendi (`addonBefore`/`addonAfter`/`addonGroup` artık çalışıyor).
- **Tutar alanı extra metni** yön mantığına uygun düzeltildi (önceki "kur ile çarpılır" yön bilgisi base/quote yönüne göre yanlış olabiliyordu).

### Changed — Döviz kuru yönü ("1 döviz = ? yerel") + hareket görmüş hesap kilidi

- **Kur yönü kuralı:** Transferde döviz kuru artık her zaman `1 [yabancı] = ? [yerel]` formundadır. UI **base** (yabancı) tarafı profil yerel para birimi olmayan tarafa otomatik atar; her iki taraf da yabancıysa `from` base'dir (geriye uyumlu varsayılan). Label: _"Döviz kuru (1 USD = ? TRY)"_. Eski "1 from = ? to" yönü kaldırıldı.
- **`TransferSchema.targetAmount?`** alanı eklendi. Cross-currency'de hedefe yansıyan tutar bu alanda **hedef currency cinsinden** depolanır (UI kur + base/quote yönüne göre hesaplayıp kaydeder). `exchangeRate` yalnız raporlama / UI referansıdır; bakiye motoru artık ona bağlı değil.
- **`movements.ts`**: cross-currency hedef leg artık `targetAmount` üzerinden. Eski kayıtlar (targetAmount yok, exchangeRate var) için geriye uyumlu fallback: `amount * exchangeRate` (eski UI mantığı). Yeni test ile doğrulandı.
- **`TransferFormDrawer`**: `baseCurrency` / `quoteCurrency` / `computedTargetAmount` computed'ları; canlı önizleme _"Hedefe yansıyacak tutar: 1.000,00 $"_; hata mesajı _"Dövizli transfer: 1 USD = ? TRY kuru girilmeli."_

### Added — Hareket görmüş hesap & kasada para birimi kilidi

- **Kural:** Bir hesap veya kasa gerçekleşmiş bir hareket (gelir / gider / transfer / borç ödemesi / kart hareketi / KMH hareketi) gördüğü andan itibaren **para birimi değiştirilemez**. Aksi takdirde geçmiş hareketler farklı currency yorumlanır ve bakiye anlamsızlaşır.
- **`AccountFormDrawer`** ve **`CashRegisterFormDrawer`**: `useAccountBalances` movements'ı üzerinden `hasMovements` tespiti; `Select` disabled olur ve FormItem extra: _"Bu hesaba/kasaya ait gerçekleşmiş hareketler olduğu için para birimi değiştirilemez."_
- Defansif submit kontrolü: UI bypass'a karşı save sırasında `code !== account.currency` ise hata mesajı + iptal.
- 1 yeni Vitest testi (eski cross-currency kayıt fallback).

### Added — Para birimi seçimi (hesap & kasa drawer) + cross-currency kuralları

- **Hesap / kasa drawer'larında para birimi `<Select>`**: `SUPPORTED_CURRENCIES` (TRY, USD, EUR, GBP) listesi; varsayılan profil yerel para birimi; eski / özel kodlar düzenleme modunda otomatik korunur (`<kod> (özel)` etiketiyle option'a eklenir). Submit'te 3 harfli ISO kodu doğrulanır + uppercase'e çevrilir.
- **Profil currency ≠ hesap/kasa currency** durumunda drawer alanında uyarı: _"Dövizli hesap/kasa: borç ödemeleri için kullanılamaz; yalnız gelir / gider / transfer kaydedilebilir."_
- **`PaymentSourcePicker`**: artık yalnız profil yerel para birimine eşit currency'li (ve arşivlenmemiş) hesap / kasaları listeler. Mevcut bir kayıtta incompatible seçim varsa "kayıp" olmasın diye yine de listede tutulur. FormItem extra hint kullanıcıyı bilgilendirir.
- **Transferde döviz kuru zorunluluğu**: Kaynak ile hedefin currency'si farklıysa form yeni bir _"Döviz kuru (1 X = ? Y)"_ alanı gösterir; submit'te zorunlu (pozitif sayı). Eşit currency'de alan gizli kalır + draft otomatik temizlenir.
- **`TransferSchema`**: opsiyonel `exchangeRate: number | undefined` (cross-currency için pozitif değer).
- **`movements.ts`**: cross-currency transferde hedef leg amount = `amount * (exchangeRate ?? 1)` — kaynak/hedef her zaman kendi currency'sinde bakiyeye yansır.
- **`TransferFormDrawer`**:
  - Aynı hesap/kasa seçilirse canlı `Alert` (warning) + submit reddi.
  - Tutar etiketi `Tutar ({fromCurrency})` (kaynak currency'i belirgin).
  - Cross-currency'de canlı önizleme: _"Hedefe yansıyacak tutar: 1.000,00 $"_.
- **`LocaleInputNumber`**: opsiyonel `precision` prop (locale tabanlı varsayılanı override eder — döviz kurunda 6 hane ihtiyacı için).
- 2 yeni Vitest testi (`movements.spec.ts`):
  - Cross-currency: TRY → USD kaynak −33.000 TRY, hedef +1.000 USD.
  - `exchangeRate` undefined → 1.0 ile çarpılır (eşit currency davranışı).

### Added — Hesap & kasa listesinde "Güncel bakiye" sütunu

- **Neden:** Engine (`collectMovements` + `accountBalance` / `cashRegisterBalance`) tüm gerçekleşmiş hareketleri (gelir / gider / transfer / kredi ödemesi / kart ödemesi & nakit avansı / KMH çekim & ödemesi / taksitli avans ödemesi) bakiyeye yansıtacak şekilde hazırdı, ama UI'da yalnızca **açılış bakiyesi** sütunu vardı; kullanıcı hareketlerin etkisini göremiyordu.
- **Yeni composable** `src/features/cashflow/useAccountBalances.ts`: ilgili tüm hareket store'larını mount'ta paralel yükler; `balancesByAccount` ve `balancesByCashRegister` reaktif map'lerini paylaşır (movements `collectMovements` üzerinden tek kanonik akış).
- **`AccountsTab`** ve **`CashRegistersTab`**: "Güncel bakiye" sütunu (açılış bakiyesinden önce); sıralanabilir + `numberRange` filtresi. Negatif bakiye `.kp-balance--negative` ile error tonunda + bold.
- Global stil: `.kp-balance` (tabular sayılar) ve `.kp-balance--negative` (`app.css`); açık + koyu temada `--ant-color-error` token'i.
- Drawer özeti / drill-through tablosu şimdilik **yok** (M7 dashboard'a saklandı — kullanıcı seçimi).

### Added — Ödeme tarihi sıralı amortizasyon istisnası

- **Kural:** Sıralı amortizasyon invariant'ında bir önceki taksitin **tutarı** plan taksitine kilitli kalır, ama **tarih** sonraki ödemenin tarihine kadar (aynı gün dahil) ileri alınabilir. Bu durumda bugünden ileri olması da serbesttir (sonraki ödeme zaten bugünden önce olduğu sürece pratik etki yok; ama mantık tutarlı).
- **Yeni helper** `disableAfter(limit?)` — `disableFutureDates`'in genel hali; `limit` verilmezse bugünü, verilirse o tarihi üst sınır olarak kullanır.
- `PaymentMarkDrawer` + `InstallmentAdvancePaymentDrawer`: `nextPaymentDate` computed (sonraki ödemelerin en erken tarihi); DatePicker `:disabled-date="disableAfter(nextPaymentDate)"`. FormItem `extra` ile açıklama: _"Sonraki ödeme DD.MM.YYYY — bu tarihe kadar ileri alınabilir."_
- 5 yeni Vitest testi (`disableAfter`).

### Added — Sıralı amortizasyon invariant'ı (taksit ödemeleri)

- **Kural:** Bir taksit ödemesi yapıldığında, ondan **sonraki** index'lerde ödeme varsa bu ödeme
  - **silinemez** ("Ödemeyi kaldır" disabled + tooltip "Önce sonraki taksit ödemelerini kaldırın")
  - **ödenen tutar** plan taksitine kilitlenir (input disabled, otomatik eşitlenir; FormItem `extra` ile "Sonraki taksit ödemeleri olduğu için tutar plan taksitine eşitlenir." açıklaması)
- Aksi takdirde kalan anapara hesabı bozulur: önceki taksite eksik tutar girip sonraki ödemeleri tutarken plan/ledger tutarsızlaşır.
- Defansif çift kontrol: `submit()` ve `unmark()` içine de aynı invariant — UI bypass'a karşı.
- Uygulandığı yerler: `PaymentMarkDrawer` (kredi taksit ödemesi) ve `InstallmentAdvancePaymentDrawer` (taksitli nakit avans ödemesi).

### Fixed — Borç sekmelerinde "Plan / Hesap özeti / Hareketler" butonları görünmüyordu

- **Kök neden:** `EntityListPage` satır aksiyonu görünürlüğünü `useAttrs()` üzerinden `'onRowClick' in attrs` ile çıkarmaya çalışıyordu. Vue 3.5+ artık declared emits'i `attrs`'a yansıtmıyor; bu nedenle koşul sürekli `false` dönüyor, butonlar render edilmiyordu. Ayrıca debt sekmelerinde `row-action-label` / `:row-action-icon` prop'ları hiç geçilmemişti.
- **Düzeltme:**
  - `EntityListPage`: `useAttrs` ve `hasRowClickListener` kaldırıldı; `hasRowAction = !!rowActionLabel && !!rowActionIcon` prop varlığına bağlandı. Tablo `__actions` sütun genişliği satır aksiyonu varsa 132px'e çıkar.
  - `LoansTab` → "Taksit planı" (`UnorderedListOutlined`).
  - `CreditCardsTab` → "Hesap özeti" (`FileTextOutlined`).
  - `CashAdvanceTab` → "Hareketler" (`HistoryOutlined`).
  - `InstallmentAdvancesTab` → "Taksit planı" (`UnorderedListOutlined`).
- Sonuç: hem masaüstü tablosunun işlem sütununda (Düzenle/Sil önünde) hem mobil kartın başlığında borç aksiyonuna **net ikonlu buton** görünür.

### Changed — Liste tablosu dikey dolgu

- `EntityListPage`: tablo alanı flex zinciri ile kalan viewport yüksekliğini doldurur; `scroll.y` + `--kp-table-body-min-h` ile gövde az satırda da tam yükseklikte kalır.

### Changed — Liste yükleme ve boş durum

- `EntityListPage`: yükleme sırasında 「Veri yok」 / özel boş mesaj gösterilmez; masaüstünde ve mobilde loader liste alanının **dikey ortasında** (`kp-list__loading` / `kp-list__cards-loading`).

### Changed — Liste tabloları yatay kaydırma

- `EntityListPage`: `scroll.x` = sütun genişlik toplamı; `table-layout: fixed`. Sütunlar artık %100 genişliğe sıkıştırılmıyor — `prepareListTableColumns` açık `width` korur, diğerlerine `minWidth` (112px) atar. Konteyner daraldığında yatay kaydırma çubuğu çıkar.
- Yatay scrollbar pagination/kayıt sayısı ile çakışmasın diye pagination'a `margin-top: 16px` + `padding-top: 4px` net boşluk.
- Liste tablosu sağ boşluk düzeltmesi: `scrollbar-gutter: stable` kaldırıldı; gövde `overflow: auto`; `scroll.x = max(sütun min toplamı, konteyner genişliği)` — tablo her durumda en az container kadar geniş; `ant-table-cell-scrollbar` placeholder gizlendi (boş sağ şerit yok).

### Added — Liste UX iyileştirmeleri (EntityListPage)

- **Filtre popover'ı:** Arama kutusunun **hemen sağında** `FilterOutlined` trigger; `<a-popover>` ile açılır filtre paneli. Aktif filtre sayısı `<a-badge>` rozeti; aktifken trigger `type="primary" ghost`. Footer'da 「Filtreyi temizle」 — built-in (banka) + declarative filtrelerin **tümünü** sıfırlar. Banka filtresi popover içinde built-in (`bank-filter` + `:banks`); diğer tüm filtreler **declarative**: `EntityListPage` yeni `:filters="ListFilter<T>[]"` prop'u ile tanımlanır. Mobilde popover viewport'a sığar (`max-width: calc(100vw - 16px)`).
- **`ListFilter<T>` tip birliği:**
  - `select` — `options[]` + `getValue(item)`; AntDV `<Select>` arama destekli (`textIncludesSearch`).
  - `numberRange` — `getValue(item)` + opsiyonel `numberKind` (`currency` / `integer` / `percent`); iki `LocaleInputNumber` (Min – Maks). URL: `<key>From` + `<key>To`.
  - `dateRange` — `getValue(item)` (ISO string); `<DatePicker.RangePicker>` (dayjs). Kıyaslama tarih kısmı (`slice(0, 10)`); URL: `<key>From=YYYY-MM-DD` + `<key>To=YYYY-MM-DD`.
- **Sayfa türüne göre filtre matrisi:**
  - Borçlar → Krediler / Taksitli avans — banka + durum (`active` / `overdue` / `closed`) + anapara + **aylık taksit** + **kalan** + vade (ay) + başlangıç tarihi.
  - Borçlar → Kredi kartları — banka + limit + borç + **kullanılabilir** + **asgari ödeme**.
  - Borçlar → Nakit avans — banka + limit + anapara + **işleyen faiz** + **toplam borç** + **kullanılabilir**.
  - Türetilen değerler (summary cache üzerinden hesaplanan `installment`, `remaining`, `available`, `accrued`, `total`, `minPayment` …) doğrudan `getValue` callback ile filtreye besleniyor — listede sütun varsa filtre de var.
  - Yönetim → Hesaplar — banka + tür (Vadesiz/Vadeli/Döviz/Diğer) + açılış bakiyesi + açılış tarihi.
  - Yönetim → Kasalar — açılış bakiyesi + açılış tarihi.
  - Yönetim → Bankalar / Gelir-Gider türleri — **Durum = kullanım** (`used` / `unused`): kayıt başka bir entity (hesap / kredi / kart / avans / gelir / gider) tarafından referans alıyorsa "Kullanımda". Arşiv segmenti (soft-delete) ile çakışmaz.
  - **Para birimi filtresi kaldırıldı** (profil para birimi sabit; kayıtlar arası dağılım anlamlı değil).
  - Nakit akışı → Gelir/Gider — tür + hedef/kaynak (`account:<id>` / `cash:<id>`) + durum (`cashflowStatus`: realized/overdue/due/upcoming) + tutar + plan/gerçek tarih aralığı.
  - Nakit akışı → Transfer — kaynak + hedef + tutar + tarih aralığı.
- **URL kalıcı liste durumu (`useListQuery`):** Arama (`q`), arşiv (`archived`), banka (`bank`), sıralama (`sort` + `order`), sayfa (`page`) ve sayfa boyutu (`size`) + declarative filtreler URL query'ye yazılır; sayfa yenilemede aynı durum geri yüklenir. `EntityListPage` `state-key` prop'u tüm anahtarları prefiks'ler (`q_loans`, `bank_loans`, `status_loans`, `principalFrom_loans` …) — sekmeli sayfalarda farklı listeler aynı parametreyi paylaşmaz. Varsayılan değerler URL'e yazılmaz (temiz URL); tüm yazımlar `router.replace` (geri yığını şişirmez). Sıralama "controlled": URL yoksa kolonun `defaultSortOrder` değeri uygulanır.
- **Liste sütunlarında tooltip kaldırıldı:** AntDV `Table` `:show-sorter-tooltip="false"`; `ellipsis: true` olan kolonlar otomatik olarak `{ showTitle: false }`'a çevriliyor; `adminPrimaryNameColumn` aynı şekilde güncellendi. Aksiyon ikonları (Düzenle / Sil) `KpTooltip` ile etiketli kalır — kural yalnızca veri sütunları için.
- **state-key tüm sekmelere uygulandı:** Borçlar (`loans`, `cards`, `cash`, `installment`), Yönetim (`banks`, `accounts`, `cash`, `income`, `expense`) ve Nakit akışı (`incomes`, `expenses`, `transfers`) için benzersiz prefiksler.
- Kural güncellemesi: `.cursor/rules/ui-patterns.mdc` "Liste" (`ListFilter<T>` + matris) + "Liste URL durumu" + "Tooltip"; `.cursor/rules/developer-ux.mdc` "Liste öncelikli UI"; `.cursor/skills/kurtarma-plani/SKILL.md` "Etkileşim" + "Liste URL state" + "Liste filtre matrisi".

### Added — M6 Nakit akışı

- **Finans motoru `cashflow.ts`:**
  - `cashflowStatus(item, asOf?)` — `realized` (fiili tarihi var) / `overdue` (vade geçti) / `due` (7 gün içi) / `upcoming`.
  - `sumByDateRange(items, { from, to, basis })` — `plan` / `actual` / `effective` tarihine göre tutar toplamı.
  - `computeDebtCoverage({ cashOnHand, expectedIncome, expectedExpense, debtDue })` — net karşılama, oran, yüzde, `canCover` bayrağı; analiz dashboard'larında (M7) kullanılacak.
- **Vitest:** 11 yeni test (`cashflow.spec.ts`); toplam **41/41** geçti.
- **Entity tipleri (Zod):**
  - `Income` — `incomeTypeId?`, hedef = `accountId` ⊕ `cashRegisterId` (Zod `refine`), `currency`, `amount`, `plannedDate`, `actualDate?` (boş = planlı, dolu = gerçekleşti).
  - `Expense` — kaynak = `accountId` ⊕ `cashRegisterId`, plan/gerçek tarih ayrımı aynı şekilde.
  - `Transfer` — `from*` ⊕ `to*` her biri hesap ⊕ kasa (4 olası kombinasyon: hesap↔hesap, hesap↔kasa, kasa↔hesap, kasa↔kasa); aynı varlık kendisine transfer engellenir.
- **Profil DB EntityType:** `transfer` eklendi (`income`, `expense` zaten vardı).
- **Bakiye hesabı `balanceHelpers.ts`:**
  - `accountBalance(account, incomes, expenses, transfers, asOf?)` — açılış + gerçekleşmiş gelir − gerçekleşmiş gider + transfer in − transfer out (planlı kayıtlar dahil edilmez).
  - `cashRegisterBalance(...)` — aynı mantık kasalar için.
  - `totalCashOnHand(...)` — tüm hesap + kasaların toplam gerçekleşmiş bakiyesi (CashflowView üst istatistik).
- **CashflowView** (`/cashflow`, sekmeli — `incomes` / `expenses` / `transfers`; `useRoutedTabs` ile URL'de tab sabit):
  - Üst yerleşim `DebtsView` / `AdminView` ile **bire bir tutarlı**: yalnız `PageHeader` + `Tabs` (Alert + Statistic'ler kaldırıldı — WIKI §9 "dağınık olmayan yerleşim").
  - Vade dikkat sayısı (overdue + due) sekme başlığında **`Badge`** olarak — `Gelirler ●3` / `Giderler ●1`; sıfırsa rozet gizli.
  - Toplam nakit + ayrıntılı borç karşılama statistic'leri M7 dashboard'una taşınacak.
- **IncomesTab / ExpensesTab** (`EntityListPage` deseni):
  - Birincil sütun = açıklama (boşsa tür adı); ek sütunlar: Tür, Hedef/Kaynak, Tutar, Plan, Gerçek, Durum.
  - **Satır içi "Gerçekleşti" / "Geri al" aksiyonu** (`__` prefix'li sütun — mobil kartta gizli, masaüstünde `Popconfirm` ile tek tık).
  - Mobil kart için status sütunu **düz string** (Tag yerine; `formatListCellValue` uyumlu).
- **TransfersTab** — Kaynak / Hedef / Tutar / Tarih; aksiyon yok (silme + düzenle EntityListPage hardcoded).
- **IncomeFormDrawer / ExpenseFormDrawer:**
  - Hedef/Kaynak radio (`account` / `cashRegister`) → ilgili `SelectWithCreate` (combobox-içinden "Yeni hesap" / "Yeni kasa" stack drawer).
  - "Tür" `SelectWithCreate` opsiyonel + stack `TypeFormDrawer`.
  - `LocaleInputNumber kind="currency"` (profil para birimi varsayılan).
  - "Gerçekleşti" `Switch` → tahsil / ödeme tarihi alanı (DatePicker) açılır; default = plan tarihi.
- **TransferFormDrawer** — `fromKind` / `toKind` radio + 2 `SelectWithCreate`; default `account → cashRegister`. Zod `refine` ile aynı varlığın kendisine transferi engellenir; UI'da da `message.error`.
- **Yönlendirme:** `/cashflow` route (`pageLayout: 'wide'`), breadcrumb `Nakit akışı`, AppShell menü `SwapOutlined` ikonu.
- **EntityListPage extension:** `dataColumns` filter artık `__` prefix'li keyleri de mobil kartlarda gizliyor (önceden sadece `__actions` + `archived`); satır-içi tek-tık aksiyon sütunları için yeniden kullanılabilir desen.

### Changed — Borçlar formlarında referansla doldurma kapsamı

- Her referans karşılığı olan faiz / vergi alanı **kendi** "Referansla doldur" düğmesini aldı (önce yalnızca bir alanda vardı ve tek düğme aynı anda birden çok alanı dolduruyordu — kullanıcının hangi alanın güncelleneceğini bilmesi zorlaşıyordu).
- **`CreditCardFormDrawer`:** Tek "hepsini doldur" düğmesi yerine 3 ayrı düğme — alışveriş faizi (limit tier'ı `tier.purchaseAprMonthly`), gecikme faizi (`tier.lateAprMonthly`), nakit avans faizi (`creditCard.cashAdvanceAprMonthly`).
- **`CashAdvanceFormDrawer`:** Faiz düğmesine ek olarak gecikme faizi alanına ayrı düğme (`cashAdvance.lateAprCeiling`). Faiz düğmesi artık `cashAdvance.monthlyAprCeiling`'i tercih ediyor (yoksa `creditCard.cashAdvanceAprMonthly`).
- **`InstallmentAdvanceFormDrawer`:** Faiz düğmesine ek olarak gecikme (`cashAdvance.lateAprCeiling`) ve vergi (`consumerLoan.taxRateKkdf + taxRateBsmv`) alanlarına ayrı düğmeler.
- **`LoanFormDrawer`:** Gecikme faizi alanına **"Sözleşmeden hesapla"** düğmesi (sözleşme × 1.3 — BDDK varsayılan kuralı, `loan.ts`'in implicit default'unu kullanıcıya görünür yapıyor). Preset'te tüketici kredisi gecikme tavanı tanımlı olmadığı için referans yerine türetilmiş değer. Bilgi tooltip'i (KpTooltip + InfoCircleOutlined) eklendi.
- Tüm `fillRef*` fonksiyonları `message.success` ile **uygulanan oranı** kullanıcıya geri bildiriyor (`%X.YZ`); referansta değer yoksa `message.info` ile uyarı.

### Changed — M5 form locale uyumu

- M5 form drawer'larındaki **6 sayısal alan tipi** `<a-input-number>` → **`<LocaleInputNumber>`** olarak değiştirildi (kind: `currency`, `percent`, `integer`). Tutar / yüzde / tamsayı girişleri profil locale'inin **ondalık ayracını** ve **maksimum hane sayısını** otomatik uygular.
- M5 formlarındaki bağımsız **"Para birimi" Select**'leri kaldırıldı; kayıtlarda `currency = profileCurrency()` (mevcut kayıtlar düzenlemede currency'lerini korur — geri uyumluluk). Bu, `LoanFormDrawer` + `AccountFormDrawer` deseniyle birebir aynı.
- `<a-select>` alanları artık tutarlı şekilde **`:options="..."`** array biçimi (kart/nakit avans işlem türleri).
- `InstallmentAdvanceFormDrawer` etkin aylık oran istatistiği: `formatNumber` ile profil locale'i (örn. `4,12 %`).
- `<a-form-item>` etiketlerinde **`required`** attribute'u doğrudan kullanılarak görsel zorunluluk göstergesi (yıldız) tüm M5 formlarına yayıldı.

## [0.5.0] — M5 Kart & avans

### Added

- **Finans motoru:**
  - `credit-card.ts` — tier'lı asgari ödeme (`creditCardMinPaymentRate`: limit `<25k` → %20, `≥25k` → %40; özelleştirilebilir `MinPaymentTiers`); dönem özeti (`creditCardStatement`: açılış + hareketler → bakiye + asgari); gecikme projeksiyonu (`creditCardLateInterest`: günlük basit, default `apr × 1.087`).
  - `cash-advance.ts` — revolving ledger (`runRevolvingLedger`): kronolojik hareketler arasında anapara üzerinden günlük basit faiz tahakkuku; ödeme **önce tahakkuk eden faizi**, sonra anaparayı kapatır; aşırı ödeme sıfırla sınırlanır.
- **Vitest:** 15 yeni test (5 `credit-card.spec.ts` + 5 `cash-advance.spec.ts`). Toplam 27 test geçti.
- **Entity tipleri (Zod):**
  - `CreditCard` (limit, `statementCutoffDay`, `paymentDueDay`, `purchaseAprMonthly`, `lateAprMonthly?`, `cashAdvanceAprMonthly?`)
  - `CreditCardTransaction` (`purchase` | `payment` | `cashAdvance`, `installmentCount?`)
  - `CashAdvanceAccount` (revolving — limit, faiz oranı, gecikme oranı)
  - `CashAdvanceTransaction` (`draw` | `payment`)
  - `InstallmentCashAdvance` (anüite + opsiyonel `cashAdvanceAccountId` bağı + `earlyPayoffWithoutInterest` bayrağı)
  - `InstallmentCashAdvancePayment` (LoanPayment ile birebir yapı)
- **Profil DB EntityType:** `creditCard`, `creditCardTransaction`, `cashAdvanceAccount`, `cashAdvanceTransaction`, `installmentCashAdvance`, `installmentCashAdvancePayment`.
- **Kredi kartı UI** (`/debts?tab=creditCards`):
  - `CreditCardsTab` — liste; satır → hesap özeti drawer; kalem ikonu → form drawer.
  - `CreditCardFormDrawer` — limit, hesap kesim / son ödeme günü, aylık alışveriş / gecikme / nakit avans faizleri; **"Referansla doldur"** limit tier'ına göre `purchase + late + cashAdvance` aylık oranı yükler.
  - `CreditCardStatementDrawer` — son 6 dönem dropdown; aktif dönemin **açılış, dönem sonu, asgari ödeme, son ödeme tarihi** istatistikleri + hareket tablosu; satır tıklama hareket düzenleme drawer.
  - `CreditCardTxnDrawer` — Alışveriş / Ödeme / Nakit avans; tutar; açıklama / notlar; "Sil" butonu (drawer stack).
- **Nakit avans (revolving) UI** (`/debts?tab=cashAdvance`):
  - `CashAdvanceTab` — liste; kalan anapara / işleyen faiz / toplam / kullanılabilir sütunları; satır → ledger drawer.
  - `CashAdvanceFormDrawer` — limit, faiz (aylık/yıllık), gecikme faizi; **"Referansla doldur"** preset'in `cashAdvanceAprMonthly` + `cashAdvanceLateAprMonthly` değerlerini alır.
  - `CashAdvanceLedgerDrawer` — anlık durum istatistikleri + kronolojik hareket tablosu; "Yeni hareket" stack drawer.
  - `CashAdvanceTxnDrawer` — Kullanım / Ödeme.
- **Taksitli nakit avans UI** (`/debts?tab=installmentAdvance`):
  - `InstallmentAdvancesTab` — kalan anapara / aylık taksit / ilerleme / durum (Devam / Gecikmiş / Kapandı); satır → taksit planı drawer.
  - `InstallmentAdvanceFormDrawer` — banka + opsiyonel "Bağlı nakit avans hesabı" combobox (stack ile yeni hesap), faiz, gecikme, KKDF/BSMV, **"Erken kapama faizsiz" bayrağı**, canlı taksit önizlemesi.
  - `InstallmentAdvanceScheduleDrawer` — Loan plan drawer'ı ile aynı yapı; "Erken kapama faizsiz" bayrağı `true` ise erken kapama tutarı sadece kalan anapara.
  - `InstallmentAdvancePaymentDrawer` — vade gecikmesinde gecikme faizi Alert; "Ödemeyi kaldır".
- **`DebtsView`:** üç sekme `disabled` durumundan çıkarıldı; tüm sekmeler aktif.
- **Helper'lar:** `cardHelpers.ts` (dönem üretici `buildCardPeriods`, en güncel dönem `latestCardStatement`), `cashAdvanceHelpers.ts` (`cashAdvanceState`), `installmentAdvanceHelpers.ts` (anüite plan + ödeme indexleme).
- **Açılış bakiyesi:** Kart + nakit avans hesabı kuruluşta "devreden bakiye" alanı (önceki dönem borcunu taşımak için).

### Notes

- M4 desenlerine birebir uyum: FormDrawer + KpTooltip + useLocaleFormatters + EntityListPage + adminPrimaryNameColumn + `kp-list-tab-pane` + useRoutedTabs + SelectWithCreate (yeni banka / nakit avans hesabı stack drawer); status sütunu **string** (mobil kart `formatListCellValue` ile uyum); "Referansla doldur" terminolojisi.
- Build: `1550.13 kB` (gzip `472.66 kB`); M4'e göre ~55 KB artış.

### Added (önceki, M4 sonrası UI/UX uyum)

- **`useLocaleFormatters`** composable (`src/composables/useLocaleFormatters.ts`): `formatCurrency`, `formatDate`, `formatDateLong`, `formatNumber` — profil `localeSettings` (locale + timeZone + currency) üzerinden. Tüm yeni bileşenlerde tek nokta; ham `Intl.*Format` kullanmama kuralı (ui-patterns.mdc).
- `EntityListPage` `@row-click` davranış kuralı: listener varsa varsayılanı (`@edit`) geçersiz kılar (krediler için taksit planı drawer).

### Fixed

- **`focusFirstFormField`:** AntDV `Select` (show-search / `SelectWithCreate`) ilk alanında odak; `.ant-select-selector` yerine gerçek `input.ant-select-selection-search-input` hedeflenir (kredi ve diğer banka combobox formları).

### Changed

- **`.kp-admin-tab-pane` → `.kp-list-tab-pane`** (generic ad). 5 admin sekmesi + borçlar sekmesi aynı sınıfı kullanır; `app.css`'te tek tanım.
- **Borçlar sayfası UI/UX uyumu** (ui-patterns.mdc + developer-ux.mdc):
  - `DebtsView` AdminView flex layout (`kp-debts` + `kp-debts-tabs`); disabled sekmeler `Empty` placeholder ile ortalı.
  - `LoansTab` `<div class="kp-list-tab-pane">` sarmalayıcısı; `adminPrimaryNameColumn('Kredi')` (280px ad sütunu, tutarlılık); status sütunu **string** `customRender` (`Tag` kaldırıldı — mobil kart `formatListCellValue` ile uyumlu); `summary()` memoize edildi (`computed` cache).
  - `LoanFormDrawer` "Preset'ten doldur" → **"Referansla doldur"** (banking-preset.mdc kuralı); gereksiz `<Tag>opsiyonel</Tag>` rozeti kaldırıldı (Form label yeterli); `useLocaleFormatters`.
  - `LoanScheduleDrawer` tarih/para `useLocaleFormatters` (hardcoded `tr-TR` kaldırıldı); tablo scroll `100dvh` (mobil viewport güvenli); başlıklar `nowrap`.
  - `PaymentMarkDrawer` tarih `useLocaleFormatters.formatDate`.

## [0.4.0] — M4 Kredi

### Added

- **Saf TS finans motoru** (`src/finance/`): `decimal.js` (28 hane, HALF_EVEN) tabanlı para; `rates.ts` (aylık/yıllık dönüşüm + günlük); `loan.ts` (`buildAnnuitySchedule`, `lateDays`, `computeLateFee`, `payoffAmount`). Anüite formülü `A = P·i·(1+i)^n / ((1+i)^n − 1)`, son taksitte yuvarlama farkı kapatılır.
- **KKDF + BSMV vergi modeli:** faize gömülü efektif aylık oran (`i_eff = i · (1 + tax)`); preset'ten tek tıkla doldurma.
- **Vitest** (`npm run test`): 12 birim test (anüite, faiz=0, yıllık→aylık, KKDF/BSMV, toplam = anapara + faiz, gecikme günü/faizi, erken kapama).
- **Entity:** `Loan`, `LoanPayment` (Zod + profil DB `EntityType` listesi); ödemeler `installmentIndex`, `dueDate`, `paidDate`, `paidAmount`, `lateFee`, `notes`.
- **`LoanFormDrawer`** (`/debts`): banka combobox + yeni banka stack drawer; aylık/yıllık faiz seçimi; gecikme faizi (boşsa sözleşme × 1.3); aylık vergi yüzdesi; canlı **taksit / toplam ödeme / toplam faiz / etkin aylık oran** önizlemesi (`Statistic`).
- **`LoanScheduleDrawer`** geniş drawer: kalan anapara, bugün için erken kapama, toplam ödenen, ilerleme; taksit tablosu (vade · taksit · faiz · anapara · kalan · durum) — satır başına **Öde / Düzenle** stack drawer açar.
- **`PaymentMarkDrawer`**: ödeme tarihi/tutarı; gecikme günü ve gecikme faizi `Alert` ile gösterilir, önerilen toplam otomatik doldurulur; ödemeyi kaldır.
- **`LoansTab` + `DebtsView`**: krediler aktif, kredi kartı/nakit avans/taksitli avans sekmeleri **disabled** ("M5'te eklenecek"). Satır tıklaması taksit planını açar; sağ üst düzenle ikonu form drawer'ı açar.
- AppShell sol menüye **Borçlar** (`CreditCardOutlined`); breadcrumb etiketi.
- `EntityListPage`: `@row-click` listener varsa satır tıklaması `row-click` emit eder, yoksa varsayılan davranış `@edit` (krediler için **plan**, yönetim için **düzenle**).

### Notes

- Erken kapama tutarı, plan üzerindeki kalan anapara + kısmi ay faizidir; banka sözleşmesi farklı uygulayabilir (Alert ile bilgilendirilir).
- `vite.config.ts` `vitest/config` üzerinden tanımlanır; `npm run test` ile çalışır.

### Added (UI altyapısı, M3 sonrası)

- **`LocaleInputNumber`** + `src/core/locale/number-format.ts`: form sayıları profil locale'ine göre.
- **`KpTooltip`**: `≤768px` tooltip gizli; mobilde `aria-label` ile erişilebilirlik.
- **`useMatchMedia`** + `KP_MOBILE_VIEWPORT_MQ` (768px): AppShell, drawer, tooltip ortak kırılım.

### Changed

- **`LocaleInputNumber` düzeltmesi:** hatalı slot yönlendirme ve AntDV ile çakışan formatter/parser kaldırıldı; drawer formları yeniden açılıyor.
- **Para birimi:** formlardan kaldırıldı; kayıt `currency` profil Bölgesel ayarından (`LoanFormDrawer`, hesap, kasa).
- **`LoanFormDrawer`:** locale uyumlu sayı girişi; faiz alanlarında 3 ondalık hane kaldırıldı.
- **`EntityListPage`:** masaüstü tablo satırına tıklanınca `@edit` (düzenleme drawer); aksiyon hücresi hariç.
- **Mobil drawer:** `FormDrawer` tam genişlik/yükseklik; `useDrawerStack` yatay kaydırma mobilde kapalı.
- **Mobil tooltip:** `app.css` yedek `.ant-tooltip` gizleme; `AppShell` ham `Tooltip` → `KpTooltip`.
- Liste sayfaları (`meta.pageLayout: 'wide'`) içerik alanında tam yatay genişlik; `/admin` bu modda. Dar sütun (800px) panel, ayarlar ve kurulum için korunur.
- Geniş sayfalarda yatay iç boşluk (`--kp-page-padding-x-wide`); dar sayfalarda `--kp-page-padding-x`.

### Changed

- `EntityListPage`: sütun genişlikleri otomatik (`stripColumnWidths`); liste dikeyde kalan viewport'u doldurur (`scroll.y` + flex layout).
- `EntityListPage` araç çubuğu: sekme içi başlık kaldırıldı; arama + yeni kayıt aynı satır; arşiv filtresi satır ortasında.
- `EntityListPage` mobil: arşiv segmenti üstte ortada; tablo yerine kart listesi (`formatListCellValue`).
- Gelir/gider türleri: `ColorPickerInput` (renk seçici), listede `ColorSwatch` renk sütunu.

### Added

- **`FormDrawer`**: stack z-index, alttaki drawer sola kaydırma, açılışta ilk form alanına focus.
- `stripColumnWidths` (`src/core/util/table-columns.ts`).
- `useDrawerFormFocus`, `useDrawerStack` genişletildi (`contentWrapperStyle`, `DRAWER_STACK_OFFSET_PX`).

## [0.3.0] — M3 yönetimsel veriler

### Added

- **Entity tipleri ve Zod şemaları** (`src/core/types/entities.ts`): `Bank`, `Account`, `CashRegister`, `IncomeType`, `ExpenseType`
- **Generic Pinia store** (`src/stores/entities.ts`): `EncryptedRepo` üzerinde `load/list/save/remove`, type bazlı reaktif koleksiyonlar; profil kilitlenince `reset()`
- **`useDrawerStack(id)`** composable: üst üste açılan drawer'lar için z-index sıralı stack (1000'den başlayıp 10'ar artar)
- **`EntityListPage`** generic bileşeni: başlık + "Yeni kayıt" + arama + arşiv segmenti (Aktif / Arşivli / Tümü) + AntDV `Table` (sort, sayfalama 10/20/50, sticky actions, boş durum)
- **`SelectWithCreate`** generic bileşeni: AntDV `Select` + `dropdownRender` footer'ında "Yeni kayıt" butonu (Hesap form'unda Banka için kullanıldı → drawer stack)
- **Form drawer'ları:** `BankFormDrawer`, `AccountFormDrawer` (banka combobox + yeni banka stack drawer), `CashRegisterFormDrawer`, `TypeFormDrawer` (Gelir/Gider türü); hepsi M1 modal/drawer kalıbına uygun
- **`/admin` (Yönetim) sayfası:** sekmeli (Bankalar / Hesaplar / Kasalar / Gelir türleri / Gider türleri) — sekme URL'de (`?tab=`), yenilemede aynı sekme açılır
- AppShell sol menü: "Yönetim" öğesi (`DatabaseOutlined`); breadcrumb route etiketi eklendi

### Notes

- Tüm yönetim formlarında "Arşivli" anahtarı var; arşivlenen kayıtlar listede varsayılan olarak gizlenir, filtreyle görüntülenebilir
- Para birimi formatlaması `Intl.NumberFormat(profile.locale, { style: 'currency', currency })` — hesap/kasa para birimine göre
- Tarihler `dayjs` ile DatePicker'da, depoda ISO string olarak saklanır

## [0.2.0] — M2 veri katmanı

### Added

- **AES-GCM şifreleme servisi** (`src/core/crypto/aes.ts`): 256-bit dataKey üretimi, PBKDF2-SHA256 (310k iter) ile wrap/unwrap, JSON ve byte düzeyinde encrypt/decrypt
- **Profil dataKey modeli:** Her profil için kalıcı bir AES dataKey üretilir; parolalı profilde wrap edilip saklanır, parolasızda raw base64 olarak saklanır. Parola değişiminde DB içeriği yeniden şifrelenmez, yalnız wrap güncellenir; parola eklenirken/kaldırılırken tüm kayıtlar tek noktadan re-encrypt edilir
- **Profil başına Dexie DB** (`kurtarma-plani.profile.<id>`): `entities` tablosu (`id`, `type`, `updatedAt`, `sensitive`, `encrypted`, `payload`); profil silindiğinde DB de silinir
- **EncryptedRepo:** Generic CRUD; parola varsa payload alanı AES-GCM, yoksa düz JSON; `reencryptAll(from, to)` parola ekleme/kaldırma için
- **useConnectivity composable:** `navigator.onLine` + `online`/`offline` olayları, refcount'lu paylaşılan reaktif durum
- **Bankacılık preset:**
  - Zod şeması (`BankingPresetSchema`) + derleme gömülü `tr-2026-01.json`
  - `bankingPreset` store'u meta DB'ye eklendi (schema v2 migration)
  - Servis: `loadActiveBankingPreset` (DB > embed), `updateBankingPresetFromFeed`, `importBankingPresetFromJson`, `resetBankingPresetToBundled`
  - Pinia `bankingPreset` store + Ayarlar > Bankacılık sekmesi (kaynak/etkin sürüm, uzaktan çek, dosyadan içe aktar, varsayılana dön)
- **Snapshot export/import:**
  - `ExportSnapshotSchema` (Zod), şifresiz `KP-RAW1` ve şifreli `KP-ENC1` dosya zarfları (PBKDF2 + AES-GCM)
  - Kullanıcı seçenekleri: hassas kayıtlar, AI gizli alanları (apiKey/baseUrl), dosya şifrelemesi
  - Ayarlar > Veri sekmesi: yedek al + dosyadan içe aktar (şifreli ise parola sorma akışı)
  - İçe aktarımda profiller yeni parolasız profil olarak eklenir (mevcut id çakışırsa yeni id üretilir)
- M1 → M2 profil migration'ı: legacy PBKDF2 hash'li profiller selectProfile sırasında doğrulanıp otomatik olarak dataKey üretilip wrap edilerek yeni şemaya geçirilir

### Changed

- `ProfilePasswordInfo` tipi yeniden tasarlandı: artık AES dataKey saklar (`dataKey`/`wrappedKey`+`wrapIv`+`salt`+`iterations`); eski `legacyHash` yalnız M1 migration için tutulur
- `useProfileStore`: `dataKey` (shallowRef) reaktif olarak tutulur; `lock()` profil DB'sini kapatır ve key'i temizler; `removeProfile()` eklendi (DB silme dahil)
- `tsconfig.app.json`: `resolveJsonModule` etkin (preset JSON import için)

### Fixed

- Snapshot import edilirken Zod ile gelen `locale` `string`'i `LocaleSettings`'e cast edilerek tip uyumsuzluğu giderildi

### Added

- M0 planlama tamamlandı
- README, mimari ve bankacılık referans belgeleri
- Cursor kuralları ve proje SKILL
- Netleştirilmiş gereksinimler:
  - Çoklu profil + isteğe bağlı parola
  - Bölgesel ayarlar (varsayılan TR, kurulumda değiştirilebilir)
  - Hassas veri işaretleme ve export seçimi
  - API anahtarları export’ta kullanıcı seçimi; AI’ya gönderilmez
  - Excel/PDF yalnızca UI rapor export’u
  - UI kit: **Ant Design Vue 4** (Tailwind yok)
  - `docs/WIKI.md` — ilk prompt gereksinimlerinin eksiksiz Wiki kaydı
  - TCMB preset: build embed + IndexedDB; çevrimiçi feed/import ile DB güncelleme
  - Offline-first; AI ve preset feed yalnızca çevrimiçi
  - `.cursor/rules/banking-preset.mdc` kuralı
  - `.cursor/rules/developer-ux.mdc` — Wiki §9 geliştirici/UI yaklaşımı (alwaysApply)
  - SKILL: Geliştirici ve UI/UX yaklaşımı bölümü eklendi

### Changed

- UI kit kararı PrimeVue/Tailwind → **Ant Design Vue 4**; `package.json` Tailwind paketleri kaldırıldı; tüm belgeler ve kurallar güncellendi

## [0.1.0] — M1 iskelet

### Added

- Vite + Vue 3 + Ant Design Vue 4 + Pinia + vue-router (hash) iskelet
- `vite-plugin-singlefile` ile tek dosya production build (`dist/index.html`)
- `<a-config-provider>` ile `tr-TR` locale + light/dark algorithm tema; sistem/açık/koyu seçici
- `AppShell`: `a-layout-sider` (collapse + manuel pin, localStorage), navbar + `a-input-search` (M3'te aktif), kilit butonu
- Zorunlu yasal disclaimer (ilk açılış modal + üst banner)
- Profil akışı: kurulum (`/setup`), seçim (`/select`); opsiyonel parola (PBKDF2-SHA256, 310k iter, 256-bit)
- Bölgesel ayarlar (locale/currency/timeZone/dateFormat) varsayılan TR; profile özel
- Dexie meta DB: `appMeta` + `profiles`; Pinia `profile` ve `ui` stores
- `HomeView` ve `SettingsView` (placeholder + profil/locale düzenleme)
- TS: strict + `verbatimModuleSyntax`; `vue-tsc` build geçer

### Fixed (M1 son düzeltmeler)

- IndexedDB `DataCloneError`: Vue 3 reactive proxy'leri DB'ye yazılmadan önce JSON ile düz objeye indir (`toPlain`)
- Sidebar UX yenilendi: pin toggle (hamburger tıklama), hover ile peek/overlay, mouse çıkışında otomatik kapanma; navbar'a route bazlı breadcrumb
- Tüm emojiler kaldırıldı; Ant Design Vue ikonları + `src/components/icons/{SunIcon,MoonIcon,BrandMark}.vue`
- localStorage UI tercihleri için sürüm migration (eski şema → varsayılana sıfırlama); ilk açılışta menü sabit gelir
- Kural: emoji yasağı (`developer-ux.mdc`, `ui-patterns.mdc`)
- Pin butonu yalnızca menü serbest moddayken görünür; hamburger toggle yeterli
- Yatay scroll sebebi: header overflow + body düzeyi scroll → kapatıldı
- Navbar arka planı açık temada `#fff`, koyu temada `#1f1f1f`
- Ayarlar → Güvenlik kartı: parola ekleme, değiştirme, kaldırma (`PasswordSection`); profile store'da `setPassword` / `clearPassword` (M2'de re-encrypt çağrısı eklenecek)
- Ayarlar sayfası tab'lı yapıya geçirildi (Profil / Bölgesel / Güvenlik); içerik ortada `max-width: 720px`
- Yasal disclaimer banner artık yalnızca Ana Sayfa'da görünür (AppShell'den kaldırıldı); modal onayı tek seferdir
- Sayfa yenilemede parolasız profil otomatik açılır (kilit butonu manuel profil değişimi için)
- Ortak `PageHeader` bileşeni: büyük başlık (28px, -640px'de 22px) + silik alt başlık; HomeView ve SettingsView'de kullanıldı
- AntDV Modal kapanırken içerik kaybolması düzeltildi: `open` ve `mode` ayrı state, `after-close` ile mode reset (M2 modal'larına kalıp)
- Tipografi: **Inter** Google Fonts'tan yüklenir (`display=swap`); offline'da sistem font fallback. AntDV `fontFamily` token'ı da güncellendi. Kural: CDN yasağında web fontu istisnası
- Tab başlıklarından ikonlar kaldırıldı (kural); sayfa başlığı 30px (mobil 24px)
