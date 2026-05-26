/**
 * AI sistem promptu için finans snapshot'ı.
 * Hassas kayıtlar ve gizli alanlar (API anahtarları vb.) dahil edilmez.
 */
import type { EntityType } from '@/core/db/profile-db'
import { AI_PROPOSAL_GUIDE } from '@/features/ai/proposals/prompt'

/** AI bağlamına hiç dahil edilmeyen entity tipleri */
const EXCLUDED_TYPES: ReadonlySet<EntityType> = new Set([
  'aiSettings',
  'aiUsage',
  'chatSession',
])

const SECRET_FIELD_KEYS = new Set([
  'apiKey',
  'baseUrl',
  'password',
  'secret',
  'token',
])

export interface AiSnapshotEntity {
  id: string
  type: EntityType
  data: unknown
}

export interface AiFinanceSnapshot {
  generatedAt: string
  profile: {
    name: string
    currency: string
    locale: string
    timeZone: string
  }
  entities: AiSnapshotEntity[]
}

export function stripSecretFields(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(stripSecretFields)
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELD_KEYS.has(key)) continue
    out[key] = stripSecretFields(val)
  }
  return out
}

export interface AiSnapshotSourceRow {
  id: string
  type: EntityType
  sensitive?: boolean
  updatedAt: string
  data: unknown
}

export function filterRowsForAiSnapshot(rows: AiSnapshotSourceRow[]): AiSnapshotEntity[] {
  const entities: AiSnapshotEntity[] = []
  for (const row of rows) {
    if (EXCLUDED_TYPES.has(row.type)) continue
    if (row.sensitive) continue
    entities.push({
      id: row.id,
      type: row.type,
      data: stripSecretFields(row.data),
    })
  }
  return entities
}

export const AI_DOMAIN_GUIDE = `Sen "Kurtarma Planı" uygulamasının kişisel finans asistanısın.
Kullanıcının borç (kredi, kredi kartı, nakit avans, taksitli avans), gelir, gider, transfer, hesap ve kasa verilerini analiz edersin.
Türkiye bankacılık bağlamına aşinasın; hesaplamalar bilgilendirme amaçlıdır, bağlayıcı değildir.
Yanıtları Türkçe ver; tutarları profil para birimiyle ifade et.
Eksik veri varsa varsayım yapma, kullanıcıya sor.
Kullanıcı ekran görüntüsü veya belge fotoğrafı yükleyebilir (ör. banka ödeme planı, ekstre, taksit tablosu). Veriyi okuyup kayıt önerisi üret; eksik alan varsa sor.
Finans verisi sohbet bağlamında [kp:snapshot] ile işaretli mesajlarda verilir; güncelleme olduğunda yeni bir bağlam mesajı eklenir. Snapshot \`entities\` dizisinde tüm finans kayıtları (\`creditCard\`, \`creditCardTransaction\`, \`cashAdvanceTransaction\` vb.) \`type\` + \`id\` + \`data\` biçiminde gelir — mevcut kayıtlara bağlanırken bu \`id\` veya kayıt adını (\`*Name\`) kullan.
Veri eklerken \`kp-proposals\` JSON bloğu zorunludur; kart/kredi hareketleri ana kayıttan **ayrı item** olarak yazılır.

${AI_PROPOSAL_GUIDE}`

export const KP_SNAPSHOT_CTX = '[kp:snapshot]'
export const KP_SNAPSHOT_ACK = '[kp:snapshot-ack]'

export function isHiddenAiContextMessage(content: string): boolean {
  return content.startsWith(KP_SNAPSHOT_CTX) || content.startsWith(KP_SNAPSHOT_ACK)
}

export function computeSnapshotFingerprint(rows: AiSnapshotSourceRow[]): string {
  const parts: string[] = []
  for (const row of rows) {
    if (EXCLUDED_TYPES.has(row.type)) continue
    parts.push(`${row.type}:${row.id}:${row.updatedAt}:${row.sensitive ? 1 : 0}`)
  }
  return parts.sort().join('\n')
}

export function buildDomainSystemPrompt(
  profile: AiFinanceSnapshot['profile'],
  customAppend?: string,
): string {
  const base = `${AI_DOMAIN_GUIDE}

Profil: ${profile.name} · ${profile.currency} · ${profile.timeZone}`

  const extra = customAppend?.trim()
  if (!extra) return base

  return `${base}

Kullanıcı talimatları (sistem prompt eklentisi):
${extra}`
}

export function buildSnapshotContextContent(
  snapshot: AiFinanceSnapshot,
  kind: 'initial' | 'update',
): string {
  const label =
    kind === 'initial' ?
      'Bağlam: güncel finans verisi'
    : 'Bağlam güncellendi: finans verisinde değişiklik var'

  return `${KP_SNAPSHOT_CTX}:${kind}
${label}

\`\`\`json
${JSON.stringify({ generatedAt: snapshot.generatedAt, entities: snapshot.entities }, null, 2)}
\`\`\``
}

export function buildSnapshotAckContent(): string {
  return `${KP_SNAPSHOT_ACK}
Finans verisi bağlam olarak alındı.`
}

/** Tam sistem promptu (JSON dahil) — test ve geriye dönük uyumluluk. */
export function buildSystemPrompt(
  snapshot: AiFinanceSnapshot,
  customAppend?: string,
): string {
  const jsonBlock = `\`\`\`json
${JSON.stringify({ generatedAt: snapshot.generatedAt, entities: snapshot.entities }, null, 2)}
\`\`\``

  const base = `${AI_DOMAIN_GUIDE}

Profil: ${snapshot.profile.name} · ${snapshot.profile.currency} · ${snapshot.profile.timeZone}

${jsonBlock}`

  const extra = customAppend?.trim()
  if (!extra) return base

  return `${base}

Kullanıcı talimatları (sistem prompt eklentisi):
${extra}`
}

export function buildAiFinanceSnapshot(
  profile: AiFinanceSnapshot['profile'],
  rows: AiSnapshotSourceRow[],
): AiFinanceSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    profile,
    entities: filterRowsForAiSnapshot(rows),
  }
}
