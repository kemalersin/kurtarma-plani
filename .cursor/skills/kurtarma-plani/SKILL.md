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

**Mimari:** Modüler, kütüphane odaklı, tekrar kullanılabilir bileşenler; finans motoru UI'dan ayrık (`src/finance/`).

**UX:** Sezgisel, sade yerleşim; mobile-first; açık/koyu tema; finans odaklı tipografi ve tutar vurgusu.

**UI kit:** Ant Design Vue 4 + `@ant-design/icons-vue`. **Tailwind kullanılmaz**; stil AntDV token + `<style scoped>` + minimal global CSS.

**Kabuk:** `<a-layout-sider>` (collapse + manuel pin), üst navbar `<a-input-search>` global arama, formlar `<a-drawer>`.

**Etkileşim:** `<a-select>` `dropdownRender` slot'unda 「Yeni Kayıt」 → drawer stack (üstte yeni form). Liste öncelikli `<a-table>`; sort/page/search/filter.

**Grafik:** ECharts dashboard + ayrı analiz/rapor sayfaları.

**Bölgesel:** `<a-config-provider :locale="trTR">`; profil `localeSettings`; varsayılan tr-TR, TRY, Europe/Istanbul. AntDV içeride `dayjs`; finans `date-fns-tz`.

**Süreç:** Milestone sırası (TODO.md); her teslimatta CHANGELOG; kural dosyaları `.cursor/rules/`.

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
| TCMB preset | Build embed + IndexedDB; çevrimiçi feed/import ile DB ezme; offline'da DB/embed |
| Çevrimiçi | Finans offline-first; AI + preset feed yalnızca online |
| AI | models.dev embed; stream; usage kalıcı; offline'da devre dışı |
| Rapor | Excel/PDF UI export only |

## Build

```bash
npm run build
FETCH_MODELS=1 npm run build
```

## Milestone sırası

M1 iskelet → M2 veri → M3 yönetimsel → M4–M5 borç → M6 akış → M7 analiz → M8 AI → M9 test

Yeni özellik eklerken `TODO.md` ve `CHANGELOG.md` güncelle.

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
