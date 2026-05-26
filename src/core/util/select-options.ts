export interface FlatSelectOption {
  value: string | number
  label: string
  disabled?: boolean
  bankName?: string
}

export interface SelectOptionGroup {
  label: string
  options: FlatSelectOption[]
}

export type SelectOptionsInput =
  | readonly FlatSelectOption[]
  | readonly SelectOptionGroup[]
  | FlatSelectOption[]
  | SelectOptionGroup[]

export function isSelectOptionGroup(item: unknown): item is SelectOptionGroup {
  return (
    typeof item === 'object' &&
    item !== null &&
    'options' in item &&
    Array.isArray((item as SelectOptionGroup).options)
  )
}

export function normalizeSelectOptionGroups(options: SelectOptionsInput | undefined): SelectOptionGroup[] {
  if (!options?.length) return []
  if (isSelectOptionGroup(options[0])) {
    return (options as SelectOptionGroup[]).map((group) => ({
      label: group.label,
      options: group.options.map((opt) => ({ ...opt, label: String(opt.label ?? opt.value) })),
    }))
  }
  return [
    {
      label: '',
      options: (options as FlatSelectOption[]).map((opt) => ({
        ...opt,
        label: String(opt.label ?? opt.value),
      })),
    },
  ]
}

export function findSelectOptionLabel(
  options: SelectOptionsInput | undefined,
  value: unknown,
): string | undefined {
  if (value == null || value === '' || !options?.length) return undefined
  for (const group of normalizeSelectOptionGroups(options)) {
    for (const opt of group.options) {
      if (opt.value === value) return opt.label
    }
  }
  return undefined
}

export function defaultFilterSelectOption(input: string, option: unknown): boolean {
  const q = input.trim().toLowerCase()
  if (!q) return true
  const opt = option as {
    label?: string
    value?: string | number
    bankName?: string
    title?: string
    children?: unknown
  }
  const label = String(opt.label ?? opt.title ?? opt.children ?? '').toLowerCase()
  const bank = String(opt.bankName ?? '').toLowerCase()
  return label.includes(q) || bank.includes(q)
}

export function filterSelectOptionGroups(
  options: SelectOptionsInput,
  input: string,
  filterOption: (input: string, option: unknown) => boolean,
): SelectOptionGroup[] {
  const q = input.trim()
  if (!q) return normalizeSelectOptionGroups(options)
  return normalizeSelectOptionGroups(options)
    .map((group) => ({
      ...group,
      options: group.options.filter((opt) => filterOption(q, opt)),
    }))
    .filter((group) => group.options.length > 0)
}
