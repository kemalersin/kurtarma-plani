import { describe, expect, it } from 'vitest'
import { textIncludesSearch } from './search'

describe('textIncludesSearch', () => {
  it('Türkçe karakterlerde tr-TR ile büyük/küçük harf duyarsız', () => {
    expect(textIncludesSearch('İş Bankası', 'iş')).toBe(true)
    expect(textIncludesSearch('İş Bankası', 'İŞ')).toBe(true)
    expect(textIncludesSearch('Eskişehir', 'ŞEHİR')).toBe(true)
    expect(textIncludesSearch('GARANTİ BBVA', 'garanti')).toBe(true)
  })

  it('ASCII alanlarda Latin toLowerCase ile eşleşir', () => {
    expect(textIncludesSearch('TR12 0001 IBAN', 'iban')).toBe(true)
    expect(textIncludesSearch('TGBATRIS', 'tgbatris')).toBe(true)
  })

  it('boş sorgu her zaman eşleşir', () => {
    expect(textIncludesSearch('Herhangi', '')).toBe(true)
    expect(textIncludesSearch('Herhangi', '   ')).toBe(true)
  })
})
