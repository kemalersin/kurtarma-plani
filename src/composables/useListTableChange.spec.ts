import { describe, expect, it, vi } from 'vitest'
import {
  applyListTableChange,
  normalizeListSortPatch,
  resolveListColumnSortDirections,
} from '@/composables/useListTableChange'
import type { ListQueryState } from '@/composables/useListQuery'

describe('applyListTableChange', () => {
  it('paginate action yalnızca sayfa patch eder', () => {
    const patch = vi.fn()
    const query = { patch } as unknown as ListQueryState

    applyListTableChange(
      query,
      15,
      { current: 2, pageSize: 25 },
      { order: null },
      { action: 'paginate' },
    )

    expect(patch).toHaveBeenCalledWith({ page: 2, size: 25 })
  })

  it('paginate sırasında boş sorter sıralamayı temizlemez', () => {
    const patch = vi.fn()
    const query = { patch } as unknown as ListQueryState

    applyListTableChange(
      query,
      15,
      { current: 3, pageSize: 15 },
      {},
      { action: 'paginate' },
    )

    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith({ page: 3, size: 15 })
  })

  it('sort action varsayılan sıralamayı URL\'e yazmaz', () => {
    const patch = vi.fn()
    const query = { patch } as unknown as ListQueryState

    applyListTableChange(
      query,
      15,
      { current: 1, pageSize: 15 },
      { columnKey: 'dueDate', order: 'ascend' },
      { action: 'sort' },
      { sortKey: 'dueDate', sortOrder: 'ascend' },
    )

    expect(patch).toHaveBeenCalledWith({ sortKey: '', sortOrder: '' })
  })

  it('sort action sıralama query patch eder', () => {
    const patch = vi.fn()
    const query = { patch } as unknown as ListQueryState

    applyListTableChange(
      query,
      15,
      { current: 1, pageSize: 15 },
      { columnKey: 'dueDate', order: 'ascend' },
      { action: 'sort' },
    )

    expect(patch).toHaveBeenCalledWith({ sortKey: 'dueDate', sortOrder: 'ascend' })
  })
})

describe('resolveListColumnSortDirections', () => {
  it('defaultSortOrder descend ise döngü descend ile başlar', () => {
    expect(
      resolveListColumnSortDirections({ sorter: () => 0, defaultSortOrder: 'descend' }),
    ).toEqual(['descend', 'ascend'])
  })

  it('sorter yoksa undefined döner', () => {
    expect(resolveListColumnSortDirections({ defaultSortOrder: 'descend' })).toBeUndefined()
  })
})

describe('normalizeListSortPatch', () => {
  it('varsayılan ile eşleşince boş patch döner', () => {
    expect(
      normalizeListSortPatch('dueDate', 'ascend', {
        sortKey: 'dueDate',
        sortOrder: 'ascend',
      }),
    ).toEqual({ sortKey: '', sortOrder: '' })
  })
})
