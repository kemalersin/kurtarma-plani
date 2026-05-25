import { describe, expect, it } from 'vitest'
import type { TableColumnType } from 'ant-design-vue'
import { resolveListCellContent } from './list-cell'
import type { KpTableColumn } from './table-columns'

describe('resolveListCellContent', () => {
  it('kpDisplay kullanır (customRender yok)', () => {
    const column = {
      key: 'status',
      title: 'Durum',
      kpDisplay: () => 'Kapandı',
    } satisfies KpTableColumn<{ id: string }>

    expect(resolveListCellContent(column as TableColumnType<{ id: string }>, { id: '1' })).toEqual({
      kind: 'text',
      text: 'Kapandı',
    })
  })
})
