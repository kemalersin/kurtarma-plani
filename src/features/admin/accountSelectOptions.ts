import type { Account, Bank } from '@/core/types/entities'

export interface BankGroupedAccountOption {
  value: string
  label: string
  bankName: string
}

export interface BankGroupedAccountOptionGroup {
  label: string
  options: BankGroupedAccountOption[]
}

/** Banka hesabı combobox'ları için banka adına göre gruplu seçenekler. */
export function buildBankGroupedAccountOptions(
  accounts: Account[],
  banks: Bank[],
  showArchived = false,
): BankGroupedAccountOptionGroup[] {
  const bankNameById = new Map(banks.map((b) => [b.id, b.name]))
  const visible = showArchived ? accounts : accounts.filter((a) => !a.archived)

  const byBank = new Map<string, Account[]>()
  for (const account of visible) {
    const list = byBank.get(account.bankId) ?? []
    list.push(account)
    byBank.set(account.bankId, list)
  }

  const sortedBankIds = [...byBank.keys()].sort((a, b) => {
    const nameA = bankNameById.get(a) ?? a
    const nameB = bankNameById.get(b) ?? b
    return nameA.localeCompare(nameB, 'tr')
  })

  return sortedBankIds.map((bankId) => {
    const bankName = bankNameById.get(bankId) ?? 'Bilinmeyen banka'
    const bankAccounts = [...(byBank.get(bankId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'tr'),
    )
    return {
      label: bankName,
      options: bankAccounts.map((account) => ({
        value: account.id,
        label: account.name,
        bankName,
      })),
    }
  })
}

export function filterBankGroupedAccountOption(input: string, option: unknown): boolean {
  const q = input.trim().toLowerCase()
  if (!q) return true
  const opt = option as { label?: string; bankName?: string; title?: string }
  const label = String(opt.label ?? opt.title ?? '').toLowerCase()
  const bank = String(opt.bankName ?? '').toLowerCase()
  return label.includes(q) || bank.includes(q)
}
