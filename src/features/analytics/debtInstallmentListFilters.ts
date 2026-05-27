import { textIncludesSearch } from '@/core/util/search'
import type { ListFilter } from '@/components/EntityListPage.vue'
import {
  debtInstallmentPaidDisplay,
  debtInstallmentTableAmount,
  debtInstallmentTypeLabel,
  type DebtInstallmentRow,
} from '@/features/analytics/reports'

export const DEBT_INSTALLMENT_LIST_FILTERS: ListFilter<DebtInstallmentRow>[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Durum',
    placeholder: 'Tümü',
    options: [
      { value: 'paid', label: 'Ödendi' },
      { value: 'partial', label: 'Kısmi ödendi' },
      { value: 'overdue', label: 'Gecikmiş' },
      { value: 'upcoming', label: 'Bekliyor' },
    ],
    getValue: (row) => {
      if (row.status === 'paid') return 'paid'
      if (debtInstallmentPaidDisplay(row) > 0) return 'partial'
      return row.status
    },
  },
  {
    kind: 'select',
    key: 'kind',
    label: 'Tür',
    placeholder: 'Tümü',
    options: [
      { value: 'loan', label: 'Kredi' },
      { value: 'creditCard', label: 'Kredi kartı' },
      { value: 'cashAdvance', label: 'Nakit avans' },
      { value: 'installmentAdvance', label: 'Taksitli avans' },
    ],
    getValue: (row) => {
      if (
        row.debtKind === 'creditCardMinPayment' ||
        row.debtKind === 'creditCardStatement'
      ) {
        return 'creditCard'
      }
      if (
        row.debtKind === 'cashAdvance' ||
        row.debtKind === 'cashAdvanceStatement'
      ) {
        return 'cashAdvance'
      }
      return row.debtKind
    },
  },
  {
    kind: 'numberRange',
    key: 'amount',
    label: 'Tutar',
    numberKind: 'currency',
    getValue: (row) => Number(debtInstallmentTableAmount(row)),
  },
]

export interface DebtInstallmentListQueryReader {
  rawValue(key: string): string
}

function getNumberRange(
  rawValue: DebtInstallmentListQueryReader['rawValue'],
  key: string,
): { min?: number; max?: number } {
  const minStr = rawValue(`${key}From`)
  const maxStr = rawValue(`${key}To`)
  const min = minStr ? Number(minStr) : undefined
  const max = maxStr ? Number(maxStr) : undefined
  return {
    min: Number.isFinite(min) ? (min as number) : undefined,
    max: Number.isFinite(max) ? (max as number) : undefined,
  }
}

function passesDebtInstallmentListFilter(
  row: DebtInstallmentRow,
  rawValue: DebtInstallmentListQueryReader['rawValue'],
): boolean {
  for (const f of DEBT_INSTALLMENT_LIST_FILTERS) {
    if (f.kind === 'select') {
      const v = rawValue(f.key)
      if (!v) continue
      const itemValue = f.getValue(row)
      if (itemValue == null || String(itemValue) !== v) return false
    } else if (f.kind === 'numberRange') {
      const { min, max } = getNumberRange(rawValue, f.key)
      if (min === undefined && max === undefined) continue
      const itemValue = f.getValue(row)
      if (itemValue == null) return false
      if (min !== undefined && itemValue < min) return false
      if (max !== undefined && itemValue > max) return false
    }
  }
  return true
}

function matchesDebtInstallmentSearch(row: DebtInstallmentRow, q: string): boolean {
  const kindLabel = debtInstallmentTypeLabel(row)
  return [row.debtName, row.bankName, kindLabel].some((value) =>
    textIncludesSearch(value, q),
  )
}

/** Taksit listesi URL filtreleri + arama — grafik ve tablo ortak. */
export function filterDebtInstallmentRows(
  rows: DebtInstallmentRow[],
  query: DebtInstallmentListQueryReader,
  search = '',
): DebtInstallmentRow[] {
  let list = rows.filter((row) => passesDebtInstallmentListFilter(row, query.rawValue))
  const q = search.trim()
  if (q) list = list.filter((row) => matchesDebtInstallmentSearch(row, q))
  return list
}
