# banking-presets

Kurtarma Planı uygulamasının **çevrimiçi bankacılık referans feed** dosyası.

## Feed

| Dosya | URL |
|-------|-----|
| `tr-latest.json` | https://raw.githubusercontent.com/kemalersin/kurtarma-plani/main/banking-presets/tr-latest.json |

Uygulama varsayılan feed URL'si: `DEFAULT_BANKING_PRESET_FEED_URL` (`src/core/constants.ts`).

## Şema

JSON, uygulamadaki `BankingPresetSchema` ile aynıdır (`src/core/types/banking-preset.ts`). `source` ve `fetchedAt` alanları feed'de **olmamalı**; uygulama çekme sırasında ekler.

Gömülü kaynak: `src/data/banking-presets/tr-*.json`.

## Güncelleme

1. `src/data/banking-presets/tr-YYYY-MM.json` güncellenir (yeni dönem).
2. `npm run sync:banking-feed` ile bu klasördeki `tr-latest.json` yeniden üretilir (`source` alanı olmadan).
3. `main` dalına push edilir.

Yerel doğrulama:

```bash
npm test -- --run src/data/banking-presets/tr-latest-feed.spec.ts
```
