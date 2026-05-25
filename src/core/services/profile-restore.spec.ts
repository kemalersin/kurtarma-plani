import { describe, expect, it } from 'vitest'
import { PLAIN_FILE_MAGIC } from '@/core/types/export'
import { buildSyncEnvelope, serializeSyncEnvelope } from '@/core/services/sync/sync-envelope'
import { restoreProfileFromText } from '@/core/services/profile-restore'

describe('restoreProfileFromText', () => {
  it('geçersiz senkron metninde hata verir', async () => {
    await expect(restoreProfileFromText('{}', 'sync')).rejects.toThrow(/KP-SYNC1/)
  })

  it('geçersiz yedek metninde hata verir', async () => {
    await expect(restoreProfileFromText('not json', 'backup')).rejects.toThrow()
  })

  it('boş snapshot senkron dosyasında hata verir', async () => {
    const inner = JSON.stringify({ magic: PLAIN_FILE_MAGIC, snapshot: { profiles: [] } })
    const envelope = await buildSyncEnvelope({
      profileId: 'p1',
      profileName: 'Ev',
      deviceId: 'dev',
      revision: 'r1',
      innerPayloadJson: inner,
      encryptFile: false,
    })
    const text = serializeSyncEnvelope(envelope)
    await expect(restoreProfileFromText(text, 'sync')).rejects.toThrow()
  })
})
