import { describe, expect, it } from 'vitest'
import {
  computePaidThroughIndex,
  displayInstallmentAmount,
  displayInstallmentDueAmount,
  displayInstallmentScheduleAmount,
  findInstallmentRollupIndex,
  installmentDueWithLateFee,
  isInstallmentFullyPaid,
  isInstallmentPartiallyPaid,
  isInstallmentUpcoming,
  projectInstallmentRowDueAmount,
  unpaidInstallmentOverrides,
  canMarkInstallmentAsPaid,
} from './installmentDisplay'
import { computeLateFee, lateDays } from '@/finance/loan'
import { D } from '@/finance/decimal'

const contractRate = { value: 0.04, period: 'monthly' as const }

describe('isInstallmentUpcoming', () => {
  it('vade bugünden sonraysa true', () => {
    expect(
      isInstallmentUpcoming('2026-06-01T00:00:00.000Z', new Date('2026-05-01T00:00:00.000Z')),
    ).toBe(true)
  })

  it('vade bugün veya geçmişteyse false', () => {
    expect(
      isInstallmentUpcoming('2026-05-01T00:00:00.000Z', new Date('2026-05-01T12:00:00.000Z')),
    ).toBe(false)
  })
})

describe('isInstallmentFullyPaid', () => {
  it('plan + gecikme faizi tam ödendiyse true', () => {
    expect(
      isInstallmentFullyPaid({
        paidDate: '2026-05-01T00:00:00.000Z',
        scheduledAmount: 7379,
        lateFee: 89.31,
        paidAmount: 7468.31,
      }),
    ).toBe(true)
  })

  it('ödenen tutar borçtan düşükse false', () => {
    expect(
      isInstallmentFullyPaid({
        paidDate: '2026-05-30T00:00:00.000Z',
        scheduledAmount: 7379,
        lateFee: 89.31,
        paidAmount: 6789.74,
      }),
    ).toBe(false)
  })

  it('paidDate yoksa false', () => {
    expect(
      isInstallmentFullyPaid({
        scheduledAmount: 1000,
        paidAmount: 1000,
      }),
    ).toBe(false)
  })
})

describe('isInstallmentPartiallyPaid', () => {
  it('eksik ödeme varsa true', () => {
    expect(
      isInstallmentPartiallyPaid({
        paidDate: '2026-05-30T00:00:00.000Z',
        scheduledAmount: 7379,
        paidAmount: 6000,
      }),
    ).toBe(true)
  })
})

describe('computePaidThroughIndex', () => {
  it('kısmi ödemeyi tam ödenmiş saymaz', () => {
    expect(
      computePaidThroughIndex([
        {
          installmentIndex: 1,
          scheduledAmount: 1000,
          paidDate: '2026-05-01T00:00:00.000Z',
          paidAmount: 600,
        },
      ]),
    ).toBe(0)
  })
})

describe('displayInstallmentAmount', () => {
  it('override kaydı plan tutarını gösterir', () => {
    expect(displayInstallmentAmount(1000, { scheduledAmount: 1200 })).toBe(1200)
  })

  it('ödenmiş kayıtta paidAmount önceliklidir', () => {
    expect(
      displayInstallmentAmount(1000, {
        scheduledAmount: 1000,
        paidDate: '2026-05-01T00:00:00.000Z',
        paidAmount: 1050,
      }),
    ).toBe(1050)
  })

  it('kısmi ödemede plan taksit tutarını gösterir', () => {
    expect(
      displayInstallmentAmount(7379.48, {
        scheduledAmount: 7379.48,
        paidDate: '2026-05-30T00:00:00.000Z',
        paidAmount: 6789.74,
      }),
    ).toBe(7379.48)
  })
})

describe('canMarkInstallmentAsPaid', () => {
  it('ilk taksit her zaman işaretlenebilir', () => {
    expect(canMarkInstallmentAsPaid(1, 0)).toBe(true)
  })

  it('önceki ödenmeden sonraki taksit işaretlenemez', () => {
    expect(canMarkInstallmentAsPaid(3, 1)).toBe(false)
    expect(canMarkInstallmentAsPaid(3, 2)).toBe(true)
  })
})

describe('unpaidInstallmentOverrides', () => {
  it('yalnızca paidDate olmayan kayıtları alır', () => {
    const map = unpaidInstallmentOverrides([
      { installmentIndex: 2, scheduledAmount: 1200 },
      { installmentIndex: 3, scheduledAmount: 800, paidDate: '2026-05-01T00:00:00.000Z', paidAmount: 800 },
    ])
    expect(map.get(2)).toBe(1200)
    expect(map.has(3)).toBe(false)
  })

  it('kısmi ödemede kalan plan tutarını override olarak ekler', () => {
    const map = unpaidInstallmentOverrides([
      {
        installmentIndex: 19,
        scheduledAmount: 7379,
        paidDate: '2026-05-30T00:00:00.000Z',
        paidAmount: 6789.74,
      },
    ])
    expect(map.get(19)).toBe(589.26)
  })
})

describe('installmentDueWithLateFee', () => {
  it('vadesi gelmemiş taksitte yalnızca plan tutarı döner', () => {
    expect(
      installmentDueWithLateFee(
        10_000,
        '2026-06-01T00:00:00.000Z',
        '2026-05-01T00:00:00.000Z',
        { contractRate },
      ),
    ).toBe('10000')
  })

  it('geciken ödenmemiş taksitte gecikme faizi eklenir', () => {
    const dueDate = '2026-03-01T00:00:00.000Z'
    const asOf = '2026-05-26T00:00:00.000Z'
    const days = lateDays(dueDate, asOf)
    const fee = computeLateFee(10_000, days, contractRate)
    expect(
      installmentDueWithLateFee(10_000, dueDate, asOf, { contractRate }),
    ).toBe(D(10_000).plus(fee).toFixed(2))
  })

  it('kayıtlı lateFee varsa onu kullanır', () => {
    expect(
      installmentDueWithLateFee(
        10_000,
        '2026-03-01T00:00:00.000Z',
        '2026-05-26T00:00:00.000Z',
        { contractRate },
        { paidDate: '2026-03-20T00:00:00.000Z', lateFee: 250 },
      ),
    ).toBe('10250')
  })
})

describe('displayInstallmentDueAmount', () => {
  it('geciken ödenmemiş taksitte gecikme faizi ekler', () => {
    const dueDate = '2026-03-01T00:00:00.000Z'
    const asOf = '2026-05-26T00:00:00.000Z'
    expect(
      displayInstallmentDueAmount(10_000, dueDate, asOf, { contractRate }),
    ).toBe(installmentDueWithLateFee(10_000, dueDate, asOf, { contractRate }))
  })

  it('vadesi gelmemiş taksitte yalnızca plan tutarı döner', () => {
    expect(
      displayInstallmentDueAmount(
        10_000,
        '2026-08-01T00:00:00.000Z',
        '2026-05-26T00:00:00.000Z',
        { contractRate },
      ),
    ).toBe('10000')
  })

  it('ödenmiş kayıtta paidAmount önceliklidir', () => {
    expect(
      displayInstallmentDueAmount(
        10_000,
        '2026-03-01T00:00:00.000Z',
        '2026-05-26T00:00:00.000Z',
        { contractRate },
        {
          scheduledAmount: 10_000,
          paidDate: '2026-03-20T00:00:00.000Z',
          paidAmount: 10_320,
        },
      ),
    ).toBe('10320')
  })

  it('kısmi ödemede kalan borcu gösterir', () => {
    const fullDue = displayInstallmentDueAmount(
      10_000,
      '2026-03-01T00:00:00.000Z',
      '2026-05-26T00:00:00.000Z',
      { contractRate },
    )
    expect(
      displayInstallmentDueAmount(
        10_000,
        '2026-03-01T00:00:00.000Z',
        '2026-05-26T00:00:00.000Z',
        { contractRate },
        {
          scheduledAmount: 10_000,
          paidDate: '2026-03-20T00:00:00.000Z',
          paidAmount: 6000,
        },
      ),
    ).toBe(D(fullDue).minus(6000).toFixed(2))
  })
})

function scheduleRows(
  firstDue: string,
  count: number,
  installment = 10_000,
): Array<{ index: number; dueDate: string; installment: string }> {
  const rows = []
  const start = new Date(firstDue)
  for (let i = 0; i < count; i++) {
    const d = new Date(start)
    d.setUTCMonth(d.getUTCMonth() + i)
    rows.push({
      index: i + 1,
      dueDate: d.toISOString(),
      installment: String(installment),
    })
  }
  return rows
}

describe('projectInstallmentRowDueAmount', () => {
  it('geciken taksit tutarını bir sonraki vade satırına taşır', () => {
    const rows = scheduleRows('2026-03-01T00:00:00.000Z', 4)
    const asOf = '2026-03-15T00:00:00.000Z'
    const payments = new Map<number, never>()

    expect(
      projectInstallmentRowDueAmount(rows[0]!, rows, 0, asOf, { contractRate }, payments),
    ).toBe('10000')

    const rolled = projectInstallmentRowDueAmount(
      rows[1]!,
      rows,
      0,
      asOf,
      { contractRate },
      payments,
    )
    const fee = computeLateFee(
      10_000,
      lateDays(rows[0]!.dueDate, rows[1]!.dueDate),
      contractRate,
    )
    expect(rolled).toBe(D(10_000).plus(10_000).plus(fee).toFixed(2))

    expect(
      projectInstallmentRowDueAmount(rows[2]!, rows, 0, asOf, { contractRate }, payments),
    ).toBe('10000')
  })

  it('ardışık geciken taksitleri bir sonraki vade satırında toplar', () => {
    const rows = scheduleRows('2026-03-01T00:00:00.000Z', 4)
    const asOf = '2026-05-26T00:00:00.000Z'
    const payments = new Map<number, never>()

    expect(findInstallmentRollupIndex(rows, 0, () => false, asOf.slice(0, 10))).toBe(4)

    const rolled = projectInstallmentRowDueAmount(
      rows[3]!,
      rows,
      0,
      asOf,
      { contractRate },
      payments,
    )
    const fee1 = computeLateFee(
      10_000,
      lateDays(rows[0]!.dueDate, rows[3]!.dueDate),
      contractRate,
    )
    const fee2 = computeLateFee(
      10_000,
      lateDays(rows[1]!.dueDate, rows[3]!.dueDate),
      contractRate,
    )
    const fee3 = computeLateFee(
      10_000,
      lateDays(rows[2]!.dueDate, rows[3]!.dueDate),
      contractRate,
    )
    expect(rolled).toBe(D(40_000).plus(fee1).plus(fee2).plus(fee3).toFixed(2))
  })

  it('kısmi ödenmiş geciken taksit kalanını sonraki vadeye devreder', () => {
    const rows = scheduleRows('2026-03-01T00:00:00.000Z', 3, 7379.48)
    const asOf = '2026-03-15T00:00:00.000Z'
    const payments = new Map([
      [
        1,
        {
          scheduledAmount: 7379.48,
          paidDate: '2026-03-10T00:00:00.000Z',
          paidAmount: 6789.74,
        },
      ],
    ])

    const row1Due = projectInstallmentRowDueAmount(
      rows[0]!,
      rows,
      0,
      asOf,
      { contractRate },
      payments,
    )
    const row2Due = projectInstallmentRowDueAmount(
      rows[1]!,
      rows,
      0,
      asOf,
      { contractRate },
      payments,
    )

    expect(row1Due).toBe('0')
    expect(Number(row2Due)).toBeGreaterThan(Number(rows[1]!.installment))
  })

  it('önceki taksit gecikmiş ve kısmi ödenmişse rollup yalnızca kalanı toplar', () => {
    const rows = scheduleRows('2026-03-01T00:00:00.000Z', 3)
    const asOf = '2026-03-20T00:00:00.000Z'
    const payments = new Map([
      [
        1,
        {
          scheduledAmount: 10_000,
          paidDate: '2026-03-15T00:00:00.000Z',
          paidAmount: 6000,
        },
      ],
    ])

    const rolled = projectInstallmentRowDueAmount(
      rows[1]!,
      rows,
      0,
      asOf,
      { contractRate },
      payments,
    )

    expect(Number(rolled)).toBeGreaterThan(Number(rows[1]!.installment))
    expect(Number(rolled)).toBeLessThan(D(10_000).plus(10_000).toNumber())
  })
})

describe('displayInstallmentScheduleAmount', () => {
  it('kısmi ödenmiş satırda plan, sonraki vadede rollup tutarı gösterir', () => {
    const rows = scheduleRows('2026-03-01T00:00:00.000Z', 3, 7379.48)
    const asOf = '2026-03-15T00:00:00.000Z'
    const payments = new Map([
      [
        1,
        {
          scheduledAmount: 7379.48,
          paidDate: '2026-03-10T00:00:00.000Z',
          paidAmount: 6789.74,
        },
      ],
    ])

    expect(
      displayInstallmentScheduleAmount(rows[0]!, rows, 0, asOf, { contractRate }, payments),
    ).toBe('7379.48')
    expect(
      Number(
        displayInstallmentScheduleAmount(rows[1]!, rows, 0, asOf, { contractRate }, payments),
      ),
    ).toBeGreaterThan(7379.48)
  })
})
