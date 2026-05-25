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

export const AI_CONTEXT_INSTRUCTIONS = `Bu dosyayı finans analizi, borç ödeme planı, nakit akışı ve bütçe önerileri için kullan.
- summary bölümünden genel pozisyonu oku.
- schedules altında krediler ve taksitli avanslar için tam amortisman tabloları vardır.
- Tutarlarda formatted alanları kullanıcıya gösterirken tercih et; value ham sayıdır.
- Eksik veya belirsiz alan varsa varsayım yapma, kullanıcıya sor.
- API anahtarı veya gizli kimlik bilgisi bu dosyada bulunmamalıdır.`
