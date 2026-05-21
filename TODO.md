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

- [ ] `bankingPreset` store + embed fallback + Zod şema
- [ ] Çevrimiçi preset feed güncelleme (DB ezme) + manuel JSON import
- [ ] `useConnectivity` (online/offline); AI ve preset feed gated
- [ ] Dexie şema v1 + migration altyapısı
- [ ] Çoklu profil store izolasyonu
- [ ] Web Crypto şifreleme + parola değişiminde re-encrypt
- [ ] `sensitive` alanı tüm entity tiplerinde
- [ ] Export/import dialog (şifre, hassas, API keys seçenekleri)
- [ ] Import Zod doğrulama + schemaVersion

## M3 — Yönetimsel veriler

- [ ] Bankalar, hesaplar, kasalar
- [ ] Gelir/gider türleri (parametrik)
- [ ] Liste: sort, page, search, filter
- [ ] Drawer formlar + combobox “Yeni Kayit” stack

## M4 — Kredi

- [ ] Kredi CRUD + anüite taksit planı
- [ ] Gecikme faizi
- [ ] Referans preset ile form doldurma (opsiyonel)

## M5 — Kart & avans

- [ ] Kredi kartı (limit, dönem, asgari, ödemeler)
- [ ] Nakit avans revolving
- [ ] Taksitli nakit avans

## M6 — Gelir & gider

- [ ] Anlık / planlı gelir-gider
- [ ] Transfer (hesap/kasa arası)
- [ ] Vade uyarıları + gerçekleşti işareti
- [ ] Borç karşılama analizi

## M7 — Analiz & rapor

- [ ] Analiz sorguları (vadeli borç, gecikme, kapama, toplamlar)
- [ ] ECharts dashboard
- [ ] Excel/PDF tablo-grafik export (UI only)

## M8 — AI

- [ ] models.dev build embed script
- [ ] Provider adapters + stream
- [ ] Sohbet kalıcılığı + usage ledger
- [ ] Snapshot’tan hassas + secrets filtreleme

## M9 — Sertleştirme

- [ ] Vitest finans motoru testleri
- [ ] E2E kritik akışlar
- [ ] Bundle boyutu optimizasyonu
