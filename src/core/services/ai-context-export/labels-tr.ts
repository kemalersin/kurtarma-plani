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
  lateInterest: 'Vade sonrası gecikme faizi (asgari altı ödeme)',
  contractualInterest: 'Tahakkuk eden akdi (anapara) faizi',
  principal: 'Anapara borcu (faiz hariç)',
  purchaseInterest: 'Vade sonrası alışveriş (akdi) faizi',
  cashAdvanceInterest: 'Vade sonrası nakit avans faizi',
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
- schedules altında kredi / taksitli avans amortisman tabloları, kart dönem vadeleri (schedules.creditCardPeriods) ve nakit avans ay sonu vadeleri (schedules.cashAdvancePeriods) vardır. **Ödenmiş geçmiş dönem/taksit satırları bağlamda yer almaz** — yalnızca güncel özet + kalan vadeler.
- schedules.loans / schedules.installmentAdvances: kalan borç özeti + **güncel ay ve sonrası** ödenmemiş taksit satırları; geçmiş ay vadeleri yok. **Kalan borcu sıfır olan borçlar dahil edilmez.**
- schedules.creditCardPeriods: hesap kesim dönemleri; taşınan borç (carriedIn), gecikme faizi (lateInterest), akdi faiz (purchaseInterest), nakit avans faizi (cashAdvanceInterest), **dönem tahakkuku (periodAccruals — taksitler dahil toplam)**, dönem sonu (endingBalance), asgari (minPayment), dönem içi ödeme (paidInPeriod). **Yalnızca güncel ay ve sonrası** ödenmemiş vade satırları; geçmiş ay vadeleri yok — toplam durum sections.creditCards altında. Asgari ödendiyse gecikme yok; kalan bakiyeye akdi faiz yansır.
- schedules.cashAdvancePeriods: revolving nakit avans **güncel ay** vadesi (endingBalance, minPayment, faiz); geçmiş ay satırları yok — toplam durum sections.cashAdvanceAccounts altında.
- Kredi kartı borcu için sections.creditCards.totalCommitted kullan (gelecek taksitler dahil); güncel dönem için currentPeriodEndingBalance ve minPayment projeksiyonludur.
- Revolving nakit avans için sections.cashAdvanceAccounts.totalDebt (anapara + faiz); güncel dönem için currentPeriodEndingBalance ve minPayment; ham hareketler sections.cashAdvanceTransactions altındadır.
- Tutarlarda formatted alanları kullanıcıya gösterirken tercih et; value ham sayıdır.
- Eksik veya belirsiz alan varsa varsayım yapma, kullanıcıya sor.
- API anahtarı veya gizli kimlik bilgisi bu dosyada bulunmamalıdır.`

/** Markdown dışa aktarım — yalnızca belgede görünen bölüm ve sütun adlarına referans verir. */
export const AI_CONTEXT_INSTRUCTIONS_MARKDOWN = `Bu belge Markdown biçimindedir; finans analizi, borç ödeme planı, nakit akışı ve bütçe önerileri için kullan.
- **Özet** bölümünden genel pozisyonu oku (net varlık, borç türleri, taksit gecikmesi, nakit akışı dikkat).
- **Krediler** tablosu ve **Kredi taksit planı** alt başlıklarından kredi vadelerini oku.
- **Taksitli nakit avans** ve **Taksitli avans planı** bölümlerinden avans vadelerini oku.
- **Kredi kartları** tablosu: Toplam yükümlülük (gelecek taksitler dahil), Güncel dönem (projeksiyonlu dönem sonu bakiyesi), Ekstre, Gelecek taksit, Asgari, Kullanılabilir, Limit.
- **Kart dönem vadeleri** tabloları: Taşınan, Gecikme faizi, **Tahakkuk (taksitler dahil toplam)**, Dönem sonu, Asgari, Ödenen — borç analizi taksit listesi ile aynı motor.
- **Nakit avans (kredili mevduat)** tablosu: Toplam borç, Anapara, Faiz, Asgari, Güncel dönem, Kullanılabilir, Limit; ham kayıtlar **Nakit avans hareketleri** tablosunda.
- **Nakit avans ay sonu vadeleri** tabloları: Akdi faiz, Gecikme, Dönem sonu, Asgari, Ödenen — borç analizi ile aynı motor.
- Tutarlar tablolarda biçimlendirilmiş (para birimi) gösterilir; kullanıcıya aynı biçimde aktar.
- **Sözlük** bölümü teknik alan adlarını açıklar; tablo başlıkları Türkçedir.
- Eksik veya belirsiz alan varsa varsayım yapma, kullanıcıya sor.
- API anahtarı veya gizli kimlik bilgisi bu dosyada bulunmamalıdır.`

/** @deprecated JSON dışa aktarım için AI_CONTEXT_INSTRUCTIONS_JSON kullanın. */
export const AI_CONTEXT_INSTRUCTIONS = AI_CONTEXT_INSTRUCTIONS_JSON
