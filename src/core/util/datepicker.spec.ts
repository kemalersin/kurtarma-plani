import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { disableFutureDates, disableAfter, disableBefore } from './datepicker'

describe('disableFutureDates', () => {
  it('bugünü devre dışı bırakmaz (gerçek ödeme bugün yapılabilir)', () => {
    expect(disableFutureDates(dayjs())).toBe(false)
  })

  it('dün için false döner (geçmiş tarih seçilebilir)', () => {
    expect(disableFutureDates(dayjs().subtract(1, 'day'))).toBe(false)
  })

  it('yarın için true döner (gelecek tarih seçilemez)', () => {
    expect(disableFutureDates(dayjs().add(1, 'day'))).toBe(true)
  })

  it('bir ay sonrası için true döner', () => {
    expect(disableFutureDates(dayjs().add(1, 'month'))).toBe(true)
  })

  it('null/undefined için false (defansif)', () => {
    expect(disableFutureDates(undefined as unknown as ReturnType<typeof dayjs>)).toBe(false)
  })
})

describe('disableAfter', () => {
  it('limit verilmezse disableFutureDates ile aynı sonuç (bugün)', () => {
    const fn = disableAfter()
    expect(fn(dayjs())).toBe(false)
    expect(fn(dayjs().add(1, 'day'))).toBe(true)
  })

  it('ileri tarihteki limit ile bugünden ileri de izin verir', () => {
    const limit = dayjs().add(7, 'day')
    const fn = disableAfter(limit)
    expect(fn(dayjs())).toBe(false)
    expect(fn(dayjs().add(3, 'day'))).toBe(false)
    expect(fn(limit)).toBe(false)
    expect(fn(limit.add(1, 'day'))).toBe(true)
  })

  it('geçmişteki limit ile yalnız limite kadar açık', () => {
    const limit = dayjs().subtract(10, 'day')
    const fn = disableAfter(limit)
    expect(fn(limit.subtract(1, 'day'))).toBe(false)
    expect(fn(limit)).toBe(false)
    expect(fn(limit.add(1, 'day'))).toBe(true)
    expect(fn(dayjs())).toBe(true)
  })

  it('ISO string limit kabul eder', () => {
    const limit = dayjs().add(3, 'day').toISOString()
    const fn = disableAfter(limit)
    expect(fn(dayjs().add(2, 'day'))).toBe(false)
    expect(fn(dayjs().add(4, 'day'))).toBe(true)
  })

  it('limit aynı gün ise gün sonu dahil tüm gün açık', () => {
    const limit = dayjs().add(1, 'day').startOf('day')
    const fn = disableAfter(limit)
    expect(fn(limit.add(23, 'hour'))).toBe(false)
    expect(fn(limit.add(1, 'day'))).toBe(true)
  })
})

describe('disableBefore', () => {
  it('limit günü ve sonrasını açık bırakır', () => {
    const limit = dayjs('2026-05-15')
    const fn = disableBefore(limit)
    expect(fn(limit.subtract(1, 'day'))).toBe(true)
    expect(fn(limit)).toBe(false)
    expect(fn(limit.add(1, 'day'))).toBe(false)
  })

  it('ISO string limit kabul eder', () => {
    const fn = disableBefore('2026-05-15T00:00:00.000Z')
    expect(fn(dayjs('2026-05-14'))).toBe(true)
    expect(fn(dayjs('2026-05-15'))).toBe(false)
  })
})
