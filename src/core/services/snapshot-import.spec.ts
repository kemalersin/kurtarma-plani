import { describe, expect, it } from 'vitest'
import { resolveUniqueProfileName } from '@/core/services/snapshot-import'

describe('resolveUniqueProfileName', () => {
  it('orijinal adı kullanır', () => {
    expect(resolveUniqueProfileName('Ev', ['İş'])).toBe('Ev')
  })

  it('çakışmada Ad 2, Ad 3 üretir', () => {
    const names = ['Ev', 'Ev 2']
    expect(resolveUniqueProfileName('Ev', names)).toBe('Ev 3')
  })

  it('boş ad için Profil varsayılanı', () => {
    expect(resolveUniqueProfileName('  ', [])).toBe('Profil')
  })
})

describe('formatImportSummaryMessage', () => {
  it('üzerine yazma mesajı', async () => {
    const { formatImportSummaryMessage } = await import('@/core/services/snapshot')
    expect(
      formatImportSummaryMessage({
        importedProfiles: 1,
        importedEntities: 12,
        skippedProfiles: 0,
        overwritten: true,
      }),
    ).toBe('Aktif profil güncellendi (12 kayıt).')
  })
})
