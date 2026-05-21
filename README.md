# Kurtarma Planı

Borçları kayıt altına alan, gelir-gider dengesini izleyen ve analiz eden **tek dosyalık statik SPA**. Backend yok; tüm veriler tarayıcıda **IndexedDB** üzerinde tutulur. Production çıktısı tek bir HTML dosyasıdır (`file://` ile açılabilir, çevrimdışı çalışır).

## Özellikler

- **Çoklu profil:** Aynı tarayıcıda birden fazla finansal profil; ilk açılışta profil seçimi
- **İsteğe bağlı parola:** Parola tanımlanırsa veriler şifrelenir; değişimde yeniden şifreleme
- **Bölgesel ayarlar:** Varsayılan Türkçe / TRY / Europe-Istanbul; ilk kurulumda değiştirilebilir
- **Bankacılık ürünleri:** Hesap, kredi, kredi kartı, nakit avans, taksitli nakit avans, gelir/gider
- **Analiz & grafikler:** Vadeli borç, gecikme, kapama tutarı, nakit akışı karşılaştırmaları
- **Dışa/içe aktarım:** JSON snapshot; opsiyonel dosya şifreleme; hassas veri ve API anahtarı dahil etme **kullanıcı seçimi**
- **Bankacılık referansı:** Sürümle gömülü preset; çevrimiçiyken feed veya dosyadan IndexedDB güncellenebilir
- **AI asistan:** Yalnızca çevrimiçiyken; stream, maliyet takibi (API anahtarları modele **gönderilmez**)
- **Rapor export:** Tablo/grafik → Excel/PDF (snapshot değil)

## Yasal uyarı

Bu uygulama bir banka veya finansal danışman değildir. Hesaplamalar ve analizler **yalnızca bilgilendirme ve kişisel planlama** amaçlıdır. Bağlayıcı sonuç için bankanızın sözleşmesi, ekstresi ve resmi mevzuat geçerlidir.

## Tech stack

| Katman | Seçim |
|--------|--------|
| Dil | TypeScript (strict) |
| UI | Vue 3 + Ant Design Vue (v4) |
| Build | Vite + vite-plugin-singlefile |
| Routing | Vue Router (hash) |
| State | Pinia |
| DB | Dexie (IndexedDB) |
| Şifreleme | Web Crypto API (PBKDF2 + AES-GCM) |
| Para | decimal.js |
| Tarih | date-fns + date-fns-tz |
| Grafik | Apache ECharts |
| Doğrulama | Zod |
| AI katalog | models.dev (build-time embed) |

## Geliştirme

```bash
npm install
npm run dev          # Geliştirme sunucusu
npm run build        # dist/index.html (tek dosya)
FETCH_MODELS=1 npm run build   # Güncel model listesi ile build
npm test             # Birim testleri
```

## Belgeler

- [Proje Wiki — ilk gereksinimler (eksiksiz)](docs/WIKI.md)
- [Mimari](docs/ARCHITECTURE.md)
- [Türkiye bankacılık referansı](docs/BANKING-TR.md)
- [Görev listesi](TODO.md)
- [Değişiklik günlüğü](CHANGELOG.md)

## Proje durumu

**M0 — Planlama ve belgeler** tamamlandı. Uygulama kodu henüz başlamadı.
