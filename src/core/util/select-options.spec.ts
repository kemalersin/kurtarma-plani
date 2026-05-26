import { describe, expect, it } from 'vitest'
import {
  filterSelectOptionGroups,
  findSelectOptionLabel,
  normalizeSelectOptionGroups,
} from '@/core/util/select-options'

describe('select-options', () => {
  it('findSelectOptionLabel flat listede etiket döner', () => {
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]
    expect(findSelectOptionLabel(options, 'b')).toBe('Beta')
  })

  it('gruplu seçeneklerde arama filtreler', () => {
    const groups = [
      {
        label: 'Bank A',
        options: [
          { value: '1', label: 'Vadesiz', bankName: 'Bank A' },
          { value: '2', label: 'Döviz', bankName: 'Bank A' },
        ],
      },
    ]
    const filtered = filterSelectOptionGroups(
      groups,
      'döviz',
      (input, option) => String((option as { label?: string }).label ?? '').toLowerCase().includes(input.toLowerCase()),
    )
    expect(normalizeSelectOptionGroups(filtered)).toEqual([
      {
        label: 'Bank A',
        options: [{ value: '2', label: 'Döviz', bankName: 'Bank A' }],
      },
    ])
  })
})
