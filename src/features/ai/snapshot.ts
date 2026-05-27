/**
 * AI sistem promptu için finans snapshot'ı.
 * Hassas kayıtlar ve gizli alanlar (API anahtarları vb.) dahil edilmez.
 */
import type { EntityType } from '@/core/db/profile-db'
import { AI_CONTEXT_VERSION } from '@/core/constants'
import type { Bank, CashAdvanceAccount, CashAdvanceTransaction, CreditCard, CreditCardTransaction, InstallmentCashAdvance, InstallmentCashAdvancePayment, Loan, LoanPayment } from '@/core/types/entities'
import type { LocaleSettings } from '@/core/types/profile'
import { buildCreditCardPeriodSchedulesFromRows } from '@/core/services/ai-context-export/credit-card-period-schedules'
import { buildCashAdvancePeriodSchedulesFromRows } from '@/core/services/ai-context-export/cash-advance-period-schedules'
import {
  buildInstallmentAdvanceSchedulesFromRows,
  buildLoanSchedulesFromRows,
} from '@/core/services/ai-context-export/loan-schedules'
import type {
  CashAdvancePeriodScheduleExport,
  CreditCardPeriodScheduleExport,
  InstallmentAdvanceScheduleExport,
  LoanScheduleExport,
} from '@/core/services/ai-context-export/types'
import {
  computeSettledDebtIndexFromSnapshotRows,
  isSettledDebtSnapshotRow,
} from '@/core/services/ai-context-export/settled-debts'
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

export interface AiFinanceDerivedContext {
  contextVersion: number
  creditCardPeriods: CreditCardPeriodScheduleExport[]
  cashAdvancePeriods: CashAdvancePeriodScheduleExport[]
  /** Kredi amortisman — güncel ay ve sonrası ödenmemiş taksit satırları + kalan borç özeti. */
  loanSchedules: LoanScheduleExport[]
  /** Taksitli avans amortisman — aynı kırpma kuralı. */
  installmentAdvanceSchedules: InstallmentAdvanceScheduleExport[]
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
  /** Finans motorundan türetilmiş analiz (ham entity'lerin yanında). */
  derived?: AiFinanceDerivedContext
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

/** AI snapshot entity listesine dahil edilmeyen tipler (türetilmiş özet yeterli). */
const SNAPSHOT_OMITTED_ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  'creditCardTransaction',
])

export function filterRowsForAiSnapshot(rows: AiSnapshotSourceRow[]): AiSnapshotEntity[] {
  const entities: AiSnapshotEntity[] = []
  for (const row of rows) {
    if (EXCLUDED_TYPES.has(row.type)) continue
    if (SNAPSHOT_OMITTED_ENTITY_TYPES.has(row.type)) continue
    if (row.sensitive) continue
    entities.push({
      id: row.id,
      type: row.type,
      data: stripSecretFields(row.data),
    })
  }
  return entities
}

/** Ayarlar, Hakkında ve uygulama kabuğu — finans snapshot'ına dahil değil; kullanıcı yönlendirmesi için. */
export const AI_APP_UI_GUIDE = `## Uygulama yapısı ve sayfalar
Ana menü: Panel (özet), Yönetim (banka/hesap/kasa/türler), Borçlar, Nakit akışı, Analiz & rapor, AI Asistan (tam sayfa sohbet), Ayarlar, Hakkında.
Sağ alttaki **AI sohbet düğmesi** (tam sayfa AI hariç) sayfa/sekme bazlı ayrı geçmiş tutar; her sekmenin kendi bağlam ipuçları vardır.
Navbar: senkron durumu, AI bağlam dışa aktarım (JSON/Markdown — sohbet geçmişi ve API anahtarları **dahil değil**), tema, profil kilitle.

## Ayarlar (#/settings?tab=…)
Sekmeler ve içerik:
- **Profil:** profil adı düzenleme; profil silme (tüm kayıtlar kalıcı silinir, geri alınamaz — önce yedek öner).
- **Bölgesel:** locale, **para birimi** (profil geneli; formlarda para birimi seçilemez), saat dilimi, tarih formatı. Tüm tutar/tarih gösterimi bu ayarlara göre.
- **Güvenlik:** opsiyonel profil parolası; etkinse IndexedDB verisi Web Crypto (PBKDF2 + AES-GCM) ile şifrelenir. Parola zorunlu değildir.
- **Bankacılık:** TCMB tabanlı referans preset (build'e gömülü + IndexedDB; çevrimiçi feed veya dosya import ile güncelleme). Kredi kartı/nakit avans/kredi hesaplarında **Referansla doldur**; sözleşme oranı her zaman kayıt düzeyinde override edilebilir.
- **AI Asistan:** sağlayıcı ekleme (Anthropic, OpenAI, Gemini, DeepSeek, Ollama, vLLM), model, opsiyonel özel sistem prompt eklentisi, **sayfa içi sohbet düğmesini gizle/göster**. API anahtarları **hassas**; export'ta kullanıcı seçimiyle, **modele asla gönderilmez**. AI yalnızca çevrimiçiyken çalışır.
- **Veri:** profil yedek dışa aktarma / içe aktarma (JSON snapshot). Hassas kayıtlar ve API anahtarları export'ta ayrı onay. Dosya parola şifrelemesi opsiyonel.
- **Senkron:** profil başına otomatik senkron dosyası (bulut klasörü: iCloud, Dropbox vb.); otomatik yazma, uzaktan okuma, isteğe bağlı dosya şifrelemesi. Çakışmada kullanıcıya modal ile yerel/uzak seçimi sunulur.
- **Güncelleme:** uzaktan sürüm kontrolü; \`index.html\` indirme (tek dosya SPA güncellemesi).

## Hakkında (#/about)
- **Kurtarma Planı:** açık kaynak kişisel finans SPA; borç, gelir-gider, nakit akışı takibi.
- **Veri gizliliği:** finans verisi sunucuya gönderilmez; tarayıcıda IndexedDB. Çoklu profil — her profil izole.
- **Çevrimdışı:** finans modülü internet olmadan tam işlevli; AI sohbet ve TCMB preset feed yalnızca çevrimiçi + kullanıcı tetiklemeli.
- **Hassas kayıtlar** (\`sensitive: true\`) ve API anahtarları AI snapshot/sohbet bağlamına **asla** girmez; export'ta kullanıcı onayı gerekir.
- **Dağıtım:** tek \`index.html\` (Vite singlefile); \`file://\` uyumlu; harici CDN/backend yok (web fontları istisna).
- **Yasal:** uygulama yalnızca bilgilendirme ve kişisel planlama içindir; bağlayıcı sonuç için banka sözleşmesi, ekstre ve resmi mevzuat geçerlidir.
- Kaynak kodu GitHub'da; canlı sürüm ve \`index.html\` indirme Hakkında sayfasından erişilebilir.`

export const AI_DOMAIN_GUIDE = `Sen "Kurtarma Planı" uygulamasının kişisel finans asistanısın.
Kullanıcının borç (kredi, kredi kartı, nakit avans, taksitli avans), gelir, gider, transfer, hesap ve kasa verilerini analiz edersin.
Türkiye bankacılık bağlamına aşinasın; hesaplamalar bilgilendirme amaçlıdır, bağlayıcı değildir.
Yanıtları Türkçe ver; tutarları profil para birimiyle ifade et.
Eksik veri varsa varsayım yapma, kullanıcıya sor.
Kullanıcı ekran görüntüsü veya belge fotoğrafı yükleyebilir (ör. banka ödeme planı, ekstre, taksit tablosu). Veriyi okuyup kayıt önerisi üret; eksik alan varsa sor.
Finans verisi sohbet bağlamında [kp:snapshot] ile işaretli mesajlarda verilir; güncelleme olduğunda yeni bir bağlam mesajı eklenir. Snapshot \`entities\` dizisinde finans kayıtları (\`creditCard\`, \`cashAdvanceTransaction\` vb.) \`type\` + \`id\` + \`data\` biçiminde gelir — mevcut kayıtlara bağlanırken bu \`id\` veya kayıt adını (\`*Name\`) kullan. **Kart hareketleri (\`creditCardTransaction\`) bağlamda yok** — kart borcu \`creditCard\` özeti ve \`derived.creditCardPeriods\` dönem vadelerinden okunur.
\`derived.creditCardPeriods\`: kart hesap kesim dönemleri — taşınan borç, gecikme faizi, **dönem tahakkuku (periodAccruals, taksitler dahil toplam)**, dönem sonu, asgari ve dönem içi ödemeler; yalnızca **güncel ay ve sonrası** ödenmemiş vade satırları (borç analizi taksit listesi ile aynı motor).
\`derived.cashAdvancePeriods\`: revolving nakit avans **güncel ay** vadesi (dönem sonu, asgari, faiz); geçmiş ay satırları yok — kümülatif durum \`cashAdvanceAccount\` entity / export hesap özetinde.
\`derived.loanSchedules\` / \`derived.installmentAdvanceSchedules\`: kredi ve taksitli avans — kalan borç özeti + **güncel ay ve sonrası** ödenmemiş taksit satırları; geçmiş ay vadeleri yok. **Kalan borcu sıfır olan borçlar bağlamda yer almaz.**
Veri eklerken \`kp-proposals\` JSON bloğu zorunludur; kart/kredi hareketleri ana kayıttan **ayrı item** olarak yazılır.

${AI_PROPOSAL_GUIDE}

${AI_APP_UI_GUIDE}`

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
${JSON.stringify(
  {
    generatedAt: snapshot.generatedAt,
    entities: snapshot.entities,
    ...(snapshot.derived ? { derived: snapshot.derived } : {}),
  },
  null,
  2,
)}
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
${JSON.stringify(
  {
    generatedAt: snapshot.generatedAt,
    entities: snapshot.entities,
    ...(snapshot.derived ? { derived: snapshot.derived } : {}),
  },
  null,
  2,
)}
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

function isArchivedEntity(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === 'object' &&
      'archived' in data &&
      (data as { archived?: boolean }).archived,
  )
}

function buildDerivedContext(
  rows: AiSnapshotSourceRow[],
  localeSettings: LocaleSettings,
  asOf: string,
): AiFinanceDerivedContext {
  const settled = computeSettledDebtIndexFromSnapshotRows(rows, { asOf })
  const creditCards: CreditCard[] = []
  const creditCardTxns: CreditCardTransaction[] = []
  const cashAdvanceAccounts: CashAdvanceAccount[] = []
  const cashAdvanceTxns: CashAdvanceTransaction[] = []
  const loans: Loan[] = []
  const loanPayments: LoanPayment[] = []
  const installmentAdvances: InstallmentCashAdvance[] = []
  const installmentPayments: InstallmentCashAdvancePayment[] = []
  const banks: Bank[] = []
  for (const row of rows) {
    if (EXCLUDED_TYPES.has(row.type) || row.sensitive || isArchivedEntity(row.data)) continue
    if (isSettledDebtSnapshotRow(row, settled)) continue
    if (row.type === 'creditCard') creditCards.push(row.data as CreditCard)
    if (row.type === 'creditCardTransaction') {
      creditCardTxns.push(row.data as CreditCardTransaction)
    }
    if (row.type === 'cashAdvanceAccount') {
      cashAdvanceAccounts.push(row.data as CashAdvanceAccount)
    }
    if (row.type === 'cashAdvanceTransaction') {
      cashAdvanceTxns.push(row.data as CashAdvanceTransaction)
    }
    if (row.type === 'loan') loans.push(row.data as Loan)
    if (row.type === 'loanPayment') loanPayments.push(row.data as LoanPayment)
    if (row.type === 'installmentCashAdvance') {
      installmentAdvances.push(row.data as InstallmentCashAdvance)
    }
    if (row.type === 'installmentCashAdvancePayment') {
      installmentPayments.push(row.data as InstallmentCashAdvancePayment)
    }
    if (row.type === 'bank') banks.push(row.data as Bank)
  }
  return {
    contextVersion: AI_CONTEXT_VERSION,
    creditCardPeriods: buildCreditCardPeriodSchedulesFromRows(
      creditCards,
      creditCardTxns,
      banks,
      localeSettings,
      asOf,
    ),
    cashAdvancePeriods: buildCashAdvancePeriodSchedulesFromRows(
      cashAdvanceAccounts,
      cashAdvanceTxns,
      banks,
      localeSettings,
      asOf,
    ),
    loanSchedules: buildLoanSchedulesFromRows(
      loans,
      loanPayments,
      banks,
      localeSettings,
      asOf,
    ),
    installmentAdvanceSchedules: buildInstallmentAdvanceSchedulesFromRows(
      installmentAdvances,
      installmentPayments,
      banks,
      localeSettings,
      asOf,
    ),
  }
}

/** Geçmiş / ödenmiş taksit ödeme kayıtlarını snapshot'tan çıkarır (derived plan yeterli). */
function filterHistoricalInstallmentPayments(
  entities: AiSnapshotEntity[],
  asOf: string,
): AiSnapshotEntity[] {
  const asOfMonth = asOf.slice(0, 7)
  return entities.filter((e) => {
    if (e.type !== 'loanPayment' && e.type !== 'installmentCashAdvancePayment') return true
    const d = e.data as { dueDate?: string; paidDate?: string }
    if (d.paidDate) return false
    if (!d.dueDate) return true
    return d.dueDate.slice(0, 7) >= asOfMonth
  })
}

export function buildAiFinanceSnapshot(
  profile: AiFinanceSnapshot['profile'],
  rows: AiSnapshotSourceRow[],
  localeSettings?: LocaleSettings,
): AiFinanceSnapshot {
  const generatedAt = new Date().toISOString()
  const settled = computeSettledDebtIndexFromSnapshotRows(rows, { asOf: generatedAt })
  const entities = filterRowsForAiSnapshot(rows).filter(
    (e) => !isSettledDebtSnapshotRow(e, settled),
  )
  const snapshot: AiFinanceSnapshot = {
    generatedAt,
    profile,
    entities,
  }
  if (localeSettings) {
    snapshot.derived = buildDerivedContext(rows, localeSettings, generatedAt)
    snapshot.entities = filterHistoricalInstallmentPayments(entities, generatedAt)
  }
  return snapshot
}
