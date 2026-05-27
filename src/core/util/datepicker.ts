import dayjs, { type Dayjs, type ConfigType } from 'dayjs'

/**
 * AntDV `<DatePicker :disabled-date="...">` için yardımcılar.
 *
 * **Kural:** Gerçek ödeme / hareket tarihleri (ör. ödenen tarih, kart
 * hareket tarihi, gerçekleşmiş cashflow tarihi) **bugünden daha ileri**
 * bir tarih olamaz; çünkü o tarihte para hesap arasında fiilen el
 * değiştirmiş olmalıdır. Planlı (upcoming) tarihler bu kuralın dışındadır.
 *
 * **İstisna:** Sıralı amortizasyonda eski bir taksit ödemesinin tarihi
 * sonraki ödemenin tarihinden önce olmak şartıyla bugünden ileri de
 * alınabilir (bkz. `disableAfter`).
 */

/**
 * Bugünün **sonundan** sonraki tüm tarihleri DatePicker'da devre dışı
 * bırakır. Bugünün kendisi seçilebilir kalır.
 */
export function disableFutureDates(current: Dayjs): boolean {
  if (!current) return false
  return current.isAfter(dayjs().endOf('day'))
}

/**
 * Verilen üst sınırdan (gün sonu) sonraki tüm tarihleri devre dışı
 * bırakan factory. `limit` verilmezse bugünü kullanır — `disableFutureDates`
 * ile birebir aynı sonuç. `limit` ileri tarihte ise (örn. sonraki taksitin
 * ödeme tarihi) DatePicker bugünden ileri de o tarihe kadar açıktır.
 *
 * @example
 * <DatePicker :disabled-date="disableAfter(nextPaymentDate)" />
 */
export function disableAfter(
  limit?: ConfigType,
): (current: Dayjs) => boolean {
  return (current: Dayjs): boolean => {
    if (!current) return false
    const cap = (limit ? dayjs(limit) : dayjs()).endOf('day')
    return current.isAfter(cap)
  }
}

/**
 * Verilen alt sınırdan (gün başı) önceki tüm tarihleri devre dışı bırakan factory.
 */
export function disableBefore(
  limit: ConfigType,
): (current: Dayjs) => boolean {
  return (current: Dayjs): boolean => {
    if (!current) return false
    const floor = dayjs(limit).startOf('day')
    return current.isBefore(floor, 'day')
  }
}

/**
 * `[startInclusive, endExclusive)` dışındaki günleri devre dışı bırakır.
 */
export function disableOutsideDateRange(
  startInclusive: ConfigType,
  endExclusive: ConfigType,
): (current: Dayjs) => boolean {
  return (current: Dayjs): boolean => {
    if (!current) return false
    const start = dayjs(startInclusive).startOf('day')
    const end = dayjs(endExclusive).startOf('day')
    return current.isBefore(start, 'day') || !current.isBefore(end, 'day')
  }
}

export function combineDisabledDates(
  ...fns: Array<(current: Dayjs) => boolean>
): (current: Dayjs) => boolean {
  return (current: Dayjs) => fns.some((fn) => fn(current))
}
