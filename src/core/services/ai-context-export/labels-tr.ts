import type { AccountType } from '@/core/types/entities'
import type { CashflowStatus } from '@/finance/cashflow'

export const AI_CONTEXT_GLOSSARY: Record<string, string> = {
  account: 'Banka hesabı',
  cashRegister: 'Kasa',
  loan: 'Kredi',
  creditCard: 'Kredi kartı',
  cashAdvanceAccount: 'Nakit avans (kredili mevduat)',
  installmentCashAdvance: 'Taksitli nakit avans',
  income: 'Gelir',
  expense: 'Gider',
  transfer: 'Transfer',
  realized: 'Gerçekleşmiş',
  overdue: 'Gecikmiş',
  due: 'Yaklaşan vade (7 gün)',
  upcoming: 'İleride',
  paid: 'Ödendi',
  unpaid: 'Ödenmedi',
  accruedLateFees: 'Biriken gecikme faizi (ödenmemiş taksitler)',
  overdueInstallmentCount: 'Vadesi geçmiş ödenmemiş taksit sayısı',
  historicalLatePaymentCount: 'Geç ödenmiş taksit sayısı (tarihsel)',
  carriedIn: 'Önceki dönemden taşınan ödenmemiş bakiye',
  lateInterest: 'Vade sonrası gecikme faizi (kart dönem projeksiyonu)',
  periodAccruals: 'Dönem içi yeni tahakkuk (alışveriş/avans/taksit)',
  endingBalance: 'Dönem sonu bakiyesi (taşınan + faiz + tahakkuk − ödeme)',
  paidInPeriod: 'Dönem ödeme penceresinde yapılan ödemeler toplamı',
  paidInFull: 'Dönem sonu bakiyesinin tamamı ödendi',
  minPaymentMet: 'Asgari ödeme karşılandı',
  currentPeriodEndingBalance: 'Güncel dönem sonu bakiyesi (projeksiyon, taşınan borç + gecikme faizi dahil)',
  accruedBalance: 'Ekstre borcu (bugüne kadar tahakkuk, ödemeler düşülmüş)',
  futureInstallments: 'Henüz tahakkuk etmemiş gelecek taksit toplamı',
  totalCommitted: 'Toplam yükümlülük (ekstre + gelecek taksitler)',
  availableCredit: 'Kullanılabilir limit',
  repaymentTotal: 'Kart borcuna yansıyan toplam (faiz dahil)',
  transactionAmount: 'İşlem tutarı (faiz hariç)',
  accrued: 'Tahakkuk etmiş (ekstreye yansımış)',
  future: 'Gelecek tahakkuk',
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Vadesiz',
  savings: 'Vadeli',
  fx: 'Döviz',
  other: 'Diğer',
}

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type
}

export function cashflowStatusLabel(status: CashflowStatus): string {
  return AI_CONTEXT_GLOSSARY[status] ?? status
}

export const AI_CONTEXT_DISCLAIMER =
  'Bu belge bilgilendirme amaçlıdır; yasal veya mali danışmanlık yerine geçmez. Hesaplamalar uygulama motoruna dayanır; banka ekstreleriyle farklılık gösterebilir.'

export const AI_CONTEXT_PURPOSE =
  'Kurtarma Planı finans verisinin AI asistanları (ChatGPT, Claude vb.) tarafından analiz edilmesi için üretilmiş bağlam dosyasıdır. Geri yükleme (import) için kullanılmaz.'

export const AI_CONTEXT_INSTRUCTIONS_JSON = `Bu dosya JSON biçimindedir; finans analizi, borç ödeme planı, nakit akışı ve bütçe önerileri için kullan.
- summary bölümünden genel pozisyonu oku.
- schedules altında kredi / taksitli avans amortisman tabloları, kart taksit tahakkuk planları (schedules.creditCards) ve kart dönem vadeleri (schedules.creditCardPeriods) vardır.
- schedules.creditCardPeriods: hesap kesim dönemleri; taşınan borç (carriedIn), gecikme faizi (lateInterest), dönem sonu (endingBalance), asgari (minPayment), dönem içi ödeme (paidInPeriod). Ödenmemiş bakiye sonraki döneme faizle taşınır.
- Kredi kartı borcu için sections.creditCards.totalCommitted kullan (gelecek taksitler dahil); güncel dönem için currentPeriodEndingBalance ve minPayment projeksiyonludur.
- sections.creditCardTransactions: ham kart hareketleri (installmentCount, repaymentTotal); taksit dağılımı schedules.creditCards altındadır.
- Tutarlarda formatted alanları kullanıcıya gösterirken tercih et; value ham sayıdır.
- Eksik veya belirsiz alan varsa varsayım yapma, kullanıcıya sor.
- API anahtarı veya gizli kimlik bilgisi bu dosyada bulunmamalıdır.`

/** Markdown dışa aktarım — yalnızca belgede görünen bölüm ve sütun adlarına referans verir. */
export const AI_CONTEXT_INSTRUCTIONS_MARKDOWN = `Bu belge Markdown biçimindedir; finans analizi, borç ödeme planı, nakit akışı ve bütçe önerileri için kullan.
- **Özet** bölümünden genel pozisyonu oku (net varlık, borç türleri, taksit gecikmesi, nakit akışı dikkat).
- **Krediler** tablosu ve **Kredi taksit planı** alt başlıklarından kredi vadelerini oku.
- **Taksitli nakit avans** ve **Taksitli avans planı** bölümlerinden avans vadelerini oku.
- **Kredi kartları** tablosu: Toplam yükümlülük (gelecek taksitler dahil), Güncel dönem (projeksiyonlu dönem sonu bakiyesi), Ekstre, Gelecek taksit, Asgari, Kullanılabilir, Limit.
- **Kart dönem vadeleri** tabloları: Taşınan, Gecikme faizi, Tahakkuk, Dönem sonu, Asgari, Ödenen sütunları — ödenmemiş bakiye sonraki döneme faizle taşınır (kısmi ödemeler Ödenen sütununda).
- **Kart taksit planı**: taksitli işlemlerin aylık tahakkuku; ham kayıtlar **Kart hareketleri** tablosunda (Taksit / Geri ödenecek sütunları).
- Tutarlar tablolarda biçimlendirilmiş (para birimi) gösterilir; kullanıcıya aynı biçimde aktar.
- **Sözlük** bölümü teknik alan adlarını açıklar; tablo başlıkları Türkçedir.
- Eksik veya belirsiz alan varsa varsayım yapma, kullanıcıya sor.
- API anahtarı veya gizli kimlik bilgisi bu dosyada bulunmamalıdır.`

/** @deprecated JSON dışa aktarım için AI_CONTEXT_INSTRUCTIONS_JSON kullanın. */
export const AI_CONTEXT_INSTRUCTIONS = AI_CONTEXT_INSTRUCTIONS_JSON
