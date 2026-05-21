# Changelog

Format [Keep a Changelog](https://keepachangelog.com/) esasına uygundur.

## [Unreleased]

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
