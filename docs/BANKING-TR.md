# Türkiye bankacılık referansı

Bu belge finans motorunun **varsayılan önerileri** ve doğrulama ipuçları içindir. Uygulama bir banka değildir; kullanıcı her zaman kendi sözleşme oranını girer.

## Resmi referans oran preset’i (TCMB preset)

### Ne değildir?

- Bankanızın sözleşme faizini otomatik değiştiren yasal motor **değildir**
- Arka planda sessizce çalışan zorunlu güncelleme **değildir** (kullanıcı tetikler veya sürümle gelir)

### Nedir?

**Belirli bir tarihte** resmi kaynaklardan (TCMB tebliği, BDDK duyurusu vb.) derlenmiş **örnek tavan oran ve kural setidir**. Yeni kredi kartı veya nakit avans formu açıldığında:

> “Varsayılanları resmi referans (Ocak 2026) ile doldur”

denirse alanlar bu JSON’daki değerlerle dolar. Kullanıcı isterse tek tek düzenler.

**Dosya örneği:** `src/data/banking-presets/tr-2026-01.json`

```json
{
  "id": "tr-2026-01",
  "label": "TCMB/BDDK referans — Ocak 2026",
  "effectiveFrom": "2026-01-01",
  "creditCard": {
    "maxRatesByBalanceTier": [
      { "maxBalance": 30000, "purchaseAprMonthly": 0.0325, "lateAprMonthly": 0.0355 },
      { "maxBalance": 180000, "purchaseAprMonthly": 0.0375, "lateAprMonthly": 0.0405 },
      { "maxBalance": null, "purchaseAprMonthly": 0.0425, "lateAprMonthly": 0.0455 }
    ],
    "cashAdvanceAprMonthly": 0.0425,
    "minPaymentRateUnder25k": 0.20,
    "minPaymentRateOver25k": 0.40
  },
  "consumerLoan": {
    "note": "Vergi ve vade limitleri bankaya göre değişir"
  }
}
```

### Yaşam döngüsü (üç katman)

| Katman | Ne zaman | Davranış |
|--------|----------|----------|
| **1. Build embed** | `npm run build` | `src/data/banking-presets/tr-*.json` derlemeye gömülür; uygulama sürümüyle birlikte gelir |
| **2. IndexedDB** | Çevrimiçi güncelleme veya ilk kullanım | Aktif preset DB’de tutulur; okuma önceliği **DB > embed** |
| **3. Çevrimiçi çekme** | Kullanıcı “Güncelle” + `navigator.onLine` | Uygun formatta JSON uzaktan indirilir, Zod ile doğrulanır, DB kaydı **tamamen ezilir** |

**Çevrimdışı:** Yalnızca IndexedDB’deki kopya (yoksa build’deki gömülü varsayılan) kullanılır.

**Çevrimiçi güncelleme akışı:**

1. Ayarlar → “Bankacılık referansını güncelle” (veya formdaki kısayol)
2. `GET` önceden tanımlı feed URL (veya kullanıcı tanımlı URL — ayarlardan)
3. Yanıt `BankingPresetSchema` ile doğrulanır (`id`, `effectiveFrom`, `creditCard`, …)
4. Başarılıysa `bankingPreset` store’a `put` → önceki DB kaydı silinir / üzerine yazılır
5. UI: `label`, `effectiveFrom`, `fetchedAt`, `source: 'remote' | 'bundled' | 'import'` gösterilir

**Manuel içe aktarım:** Kullanıcı JSON dosyası seçer → aynı şema doğrulaması → DB ezer (feed ile aynı kurallar).

Uzak kaynak formatı, gömülü JSON ile **aynı şema** olmalıdır (sürüm alanı `schemaVersion` ile uyumlu).

Mevzuat değişince **sizin girdiğiniz sözleşme oranları** geçerlidir; preset yalnızca kolaylık içindir.

---

## Ürün kuralları (özet)

### Kredi kartı

- Dönem borcuna göre kademeli azami akdi faiz (2026 referans: %3,25 / %3,75 / %4,25 aylık)
- Gecikme faizi genelde akdi + ~0,30 puan
- Asgari ödeme: limit &lt;25.000 TL → %20; ≥25.000 TL → %40
- Tam/kısmi ödeme her tarihte kaydedilir; ödenmeyen bakiyeye gecikme projeksiyonu

### İhtiyaç kredisi

- Eşit taksit (anüite)
- Faiz üzerine KKDF+BSMV (çoğu bankada %30 vergi yükü) — motor opsiyonel
- BDDK vade sınırları (tutara göre 12–36 ay) — uyarı olarak gösterilir

### Nakit avans (revolving)

- Kullanım borç yaratır; kısmi ödeme sonrası faiz **kalan anapara** üzerinden
- Limit, aylık faiz, gecikme faizi kullanıcı tanımlı

### Taksitli nakit avans

- Sabit taksit planı; taksit ödendi/gecikti işareti
- Erken kapama: kalan anapara tek seferde, faizsiz kapama bayrağı

### Yapılandırma (2026 dönemi)

BDDK düzenlemeleri (ör. 48 ay KK yapılandırması, %3,11 ref. faiz) ayrı **senaryo şablonu** olarak ileride eklenebilir; MVP’de kullanıcı manuel plan girer.

---

## Hesaplama notları

- Para: `decimal.js`, yuvarlama bankacılık modu (half-up, 2 hane TRY)
- Tarih: profil `timeZone`; gün sayımı gecikmede açıkça modellenir (30/360 vs gerçek gün — ürün ayarı)
- Kapama tutarı: vade tarihi + kalan borç + işleyen faiz + gecikme

## Kaynaklar (planlama dönemi)

- [TCMB — Kredi kartı azami faiz oranları](https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Bankacilik+Verileri/Kredi_Karti_Islemlerinde_Uygulanacak_Azami_Faiz_Oranlari)
- BDDK duyuruları (yapılandırma, KMH limitleri)
