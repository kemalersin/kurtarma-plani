# Mimari

## Dağıtım modeli

- **Build:** Vite + `vite-plugin-singlefile` → tüm JS/CSS/font/icon inline → `dist/index.html`
- **Routing:** Hash (`#/…`); History API kullanılmaz (`file://` uyumu)
- **Harici bağımlılık yok:** Runtime CDN yok; SVG/icon build’de gömülür
- **Offline-first:** Tüm finans CRUD, analiz, export/import (yerel dosya) çevrimdışı çalışır
- **Çevrimiçi opsiyonel:** TCMB preset feed güncellemesi ve AI yalnızca ağ varken devreye girer

## Katmanlar

```
UI (Ant Design Vue, AppShell, DrawerStack, Table, ECharts)
  ↓
Features (sayfa composables, formlar, listeler)
  ↓
Domain (bank, loan, card, advance, income, expense, profile)
  ↓
Finance Engine (saf hesaplama, test edilebilir)
  ↓
Core (Dexie, crypto, migration, export/import, format, search index)
```

## Profiller

Her profil izole bir veri adayıdır:

| Store | Açıklama |
|-------|----------|
| `_meta` | Profil listesi, aktif profil id |
| `profile:{id}:*` | Profil verileri (şifreli veya düz) |

**İlk açılış akışı:**

1. Profil yok → kurulum sihirbazı (profil adı, bölgesel ayarlar, isteğe bağlı parola)
2. Birden fazla profil → seçim ekranı (parola varsa aynı ekranda)
3. Tek profil → doğrudan veya parola kilidi

Parola **zorunlu değil**. Parola yoksa veriler şifrelenmez; export dosyası kullanıcı seçimiyle şifrelenebilir.

## Bölgesel ayarlar (profil başına)

İlk kurulumda (parola adımıyla birlikte) yapılandırılır:

- `locale` (varsayılan `tr-TR`)
- `currency` (varsayılan `TRY`)
- `timeZone` (varsayılan `Europe/Istanbul`)
- `dateFormat` (ör. `dd.MM.yyyy`)

Tüm `Intl` ve `date-fns-tz` formatları bu ayarlardan okunur.

## Şifreleme

| Durum | Davranış |
|-------|----------|
| Parola tanımlı | PBKDF2-SHA256 (≥310k) → AES-256-GCM; payload şifreli store |
| Parola yok | Düz JSON store (yine IndexedDB) |
| Parola değişimi | Tüm şifreli kayıtlar yeni anahtarla re-encrypt |
| Parola hash | Ayrı alan; düz metin saklanmaz |

## Hassas veri

Her kayıt `sensitive?: boolean` taşıyabilir.

- **Dışa aktarım:** Kullanıcıya “Hassas veriler dahil edilsin mi?” sorulur
- **AI sistem promptu:** Hassas işaretli kayıtlar ve API anahtarları **asla** snapshot’a dahil edilmez
- **Ekran:** Hassas kayıtlar listede görsel olarak ayırt edilir (opsiyonel maskeleme)

## Dışa / içe aktarım

**Snapshot formatı:** `kurtarma-plani-export` JSON, `schemaVersion`, checksum.

Export seçenekleri (dialog):

1. Dosyayı şifrele (evet/hayır + parola)
2. Hassas verileri dahil et (evet/hayır)
3. AI provider ayarlarını / API anahtarlarını dahil et (evet/hayır)

Import: şema sürümü + Zod doğrulama; şifreli dosyada parola istenir.

**AI bağlam dışa aktarımı (navbar):** `kurtarma-plani-ai-context` — JSON / Markdown; **içe aktarılamaz**. Modül: `src/core/services/ai-context-export/`. Arşiv kayıtları varsayılan hariç; hassas kayıt kullanıcı onayıyla; tam taksit planları; banking preset dahil değil.

**Entity şeması değişince:** `entities.ts` veya Dexie migration ile birlikte AI bağlam (`ai-context-export`, `AI_CONTEXT_VERSION`) ve gerekiyorsa yedek/senkron (`ExportSnapshotSchema`, `buildSnapshot` / `importSnapshot`, `stripSecrets`; kırıcı değişiklikte `SCHEMA_VERSION`, senkron üst zarfında `SYNC_SCHEMA_VERSION`) aynı teslimatta gözden geçirilir. Yalnızca geriye uyumlu alan ekleme çoğu zaman export Zod’unu değiştirmez (`entities[].data` = `unknown`).

**Otomatik senkron:** `KP-SYNC1` dış zarf + içeride export ile aynı snapshot (`KP-RAW1` / `KP-ENC1`). Ayrıntı [SYNC.md](./SYNC.md).

Excel/PDF yalnızca UI’daki tablo/grafik export’u içindir; snapshot ile karıştırılmaz.

## Çevrimdışı / çevrimiçi ayrımı

| Özellik | Çevrimdışı | Çevrimiçi |
|---------|------------|-----------|
| Profil, borç, gelir/gider | ✅ | ✅ |
| Analiz, grafikler | ✅ | ✅ |
| Snapshot export/import | ✅ | ✅ |
| TCMB preset feed güncelleme | ❌ (DB/embed yeterli) | ✅ (kullanıcı tetikler) |
| AI sohbet / stream | ❌ | ✅ |
| models.dev katalog | ✅ (build embed) | ✅ |

**Bağlantı algılama:** `navigator.onLine` + isteğe bağlı hafif probe; `online` / `offline` olaylarına abone ol.

**AI UI (çevrimdışı):** Sohbet paneli devre dışı; “Çevrimiçi olduğunuzda kullanılabilir” mesajı. Menüde AI öğesi görünür ama tıklanınca bilgilendirme (veya tamamen gizleme — tercih: görünür + disabled).

**Çekirdek uygulama** ağ hatasında çökmez; AI çağrıları yapılmaz.

## Bankacılık referans preset (IndexedDB)

Store: `bankingPreset` (tek aktif kayıt veya `id` ile versiyon; okumada en güncel `effectiveFrom`).

```
Öncelik: IndexedDB (varsa) → build embed fallback
Güncelleme: çevrimiçi GET feed | manuel JSON import → Zod → put (ezme)
```

Ayrıntı: [BANKING-TR.md](./BANKING-TR.md).

## AI

- **Yalnızca çevrimiçi:** `useOnline()` false iken adapter çağrılmaz
- Provider adapter: Anthropic, OpenAI, Gemini, DeepSeek, Ollama, vLLM (OpenAI-compatible)
- Model listesi: build’de `models.dev` embed; Ollama/vLLM için `baseUrl` + manuel model veya `/api/tags`
- Stream: SSE/fetch reader; anlık token + maliyet (models.dev `cost` alanları, 1M token USD)
- Kalıcılık: `chatSessions`, `usageLedger` (sohbet silinse bile usage kalır)
- Sistem prompt: finans snapshot (hassas + secrets hariç) + domain kılavuzu (`AI_DOMAIN_GUIDE` + `AI_PROPOSAL_GUIDE` — `src/features/ai/snapshot.ts`, `src/features/ai/proposals/prompt.ts`)
- **Kayıt önerisi (`kp-proposals`):** Asistan yanıtındaki fenced JSON blokları parse → resolve (`*Ref`/`*Name` → id) → apply (IndexedDB). Tüm finans entity tipleri desteklenir; kart/nakit avans **hareketleri** ana kayıttan ayrı `creditCardTransaction` / `cashAdvanceTransaction` item olarak gelir. Kılavuz `entities.ts` şeması ve `resolve.ts` zorunlu alanlarıyla senkron tutulur.

## UI kalıpları

- **UI kit:** Ant Design Vue 4 (`ant-design-vue`, `@ant-design/icons-vue`)
- **Stil yaklaşımı:** AntDV v5 design token sistemi (`ConfigProvider` + `theme`); Tailwind kullanılmaz; özelleştirme `<style scoped>` + global `app.css`
- **AppShell:** `<a-layout>` + `<a-layout-sider>` (collapsible + manuel pin); üst navbar + `<a-input-search>` global arama
- **Listeler:** `<a-table>` client-side sort/page/filter (Dexie query)
- **Formlar:** `<a-drawer>`; combobox “Yeni Kayıt” → üst üste drawer (z-index stack)
- **Combobox:** `<a-select>` + `dropdownRender` slot (footer’da “Yeni Kayıt”)
- **Tema:** `theme.defaultAlgorithm` / `theme.darkAlgorithm`; sistem tercihi + manuel toggle; mobile-first ek CSS
- **Lokalizasyon:** `<a-config-provider :locale="trTR">`; AntDV içinde `dayjs` kullanılır
- **Icon:** `@ant-design/icons-vue` (on-demand import, SVG inline)

## Tarih kütüphaneleri

- **Finans motoru:** `date-fns` + `date-fns-tz` (saf hesaplama, timezone duyarlı)
- **UI (AntDV):** `dayjs` (AntDV içinde zaten gömülü; DatePicker vb. için)
- Dönüşüm yardımcıları `src/core/format/` altında

## Finans motoru

Saf TypeScript modülleri (`src/finance/`):

- `amortization` — kredi / taksitli avans
- `creditCardCycle` — dönem, asgari, ödeme
- `revolvingInterest` — nakit avans kalan borç faizi
- `lateFee` — gecikme
- `projection` — kapama tutarı, risk, öngörü
- `cashflow` — gelir/gider vs borç karşılama

Banka sözleşme oranları her zaman kullanıcı girdisidir. Resmi tavanlar için bkz. [BANKING-TR.md](./BANKING-TR.md) (referans preset).

## Şema sürümleme

- `schemaVersion` artışında migration script
- Export/import uyumsuz sürümde kontrollü hata veya kısmi import politikası (TODO’da netleştirilecek)
