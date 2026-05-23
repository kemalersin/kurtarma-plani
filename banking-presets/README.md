# banking-presets

Kurtarma Planı uygulamasının **çevrimiçi bankacılık referans feed** deposu.

## Feed

| Dosya | URL |
|-------|-----|
| `tr-latest.json` | https://raw.githubusercontent.com/kurtarma-plani/banking-presets/main/tr-latest.json |

Uygulama varsayılan feed URL'si: `DEFAULT_BANKING_PRESET_FEED_URL` (`src/core/constants.ts`).

## Şema

JSON, uygulamadaki `BankingPresetSchema` ile aynıdır (`src/core/types/banking-preset.ts`). `source` ve `fetchedAt` alanları feed'de **olmamalı**; uygulama çekme sırasında ekler.

Gömülü kaynak: `src/data/banking-presets/tr-*.json` (ana uygulama deposu).

## Güncelleme

1. Ana repoda `src/data/banking-presets/tr-YYYY-MM.json` güncellenir (yeni dönem).
2. Bu repodaki `tr-latest.json` aynı içerikle güncellenir (`source` alanı olmadan).
3. `main` dalına push edilir.

Yerel doğrulama (ana repo kökünden):

```bash
npm test -- --run src/data/banking-presets/tr-latest-feed.spec.ts
```

## Yayın

Bu klasör ayrı bir GitHub deposu olarak yayınlanır:

```bash
cd banking-presets
git init
git add tr-latest.json README.md
git commit -m "Add tr-latest banking preset feed"
git branch -M main
git remote add origin git@github.com:kurtarma-plani/banking-presets.git
git push -u origin main
```
