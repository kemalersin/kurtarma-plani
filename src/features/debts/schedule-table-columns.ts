import type { TableColumnType } from 'ant-design-vue'
import type { ScheduleRow } from '@/finance/loan'

/** Kredi / taksitli avans taksit planı drawer tablosu sütunları. */
export function buildScheduleDrawerColumns(
  formatDate: (iso: string) => string,
  formatMoney: (value: string | number) => string,
): TableColumnType<ScheduleRow>[] {
  return [
    { key: 'index', title: '#', dataIndex: 'index', width: 56 },
    {
      key: 'dueDate',
      title: 'Vade',
      minWidth: 112,
      customRender: ({ record }) => formatDate(record.dueDate),
    },
    {
      key: 'installment',
      title: 'Taksit',
      align: 'right',
      minWidth: 120,
      customRender: ({ record }) => formatMoney(record.installment),
    },
    {
      key: 'interest',
      title: 'Faiz',
      align: 'right',
      minWidth: 112,
      customRender: ({ record }) => formatMoney(record.interest),
    },
    {
      key: 'principal',
      title: 'Anapara',
      align: 'right',
      minWidth: 112,
      customRender: ({ record }) => formatMoney(record.principal),
    },
    {
      key: 'endingBalance',
      title: 'Kalan anapara',
      align: 'right',
      minWidth: 120,
      customRender: ({ record }) => formatMoney(record.endingBalance),
    },
    { key: 'status', title: 'Durum', width: 110 },
  ]
}
