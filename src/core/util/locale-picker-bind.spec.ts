import dayjs, { type Dayjs } from 'dayjs'
import { describe, expect, it } from 'vitest'
import {
  localePickerBindFromAttrs,
  readDisabledDateFromBind,
} from '@/core/util/locale-picker-bind'

describe('locale-picker-bind', () => {
  it('localePickerBindFromAttrs tetikleyici attrs ayırır, picker kurallarını korur', () => {
    const disabledDate = (current: Dayjs) => current.isAfter(dayjs().endOf('day'))
    const bind = localePickerBindFromAttrs(
      {
        disabled: true,
        placeholder: 'Tarih',
        mobileTitle: 'Seç',
        size: 'middle',
        style: 'width:100%',
        class: 'x',
        disabledDate,
        showTime: true,
      },
      'DD.MM.YYYY',
    )

    expect(bind).toEqual({
      format: 'DD.MM.YYYY',
      disabledDate,
      showTime: true,
    })
  })

  it('readDisabledDateFromBind yalnızca fonksiyon döndürür', () => {
    const fn = () => false
    expect(readDisabledDateFromBind({ disabledDate: fn })).toBe(fn)
    expect(readDisabledDateFromBind({ disabledDate: 'x' })).toBeUndefined()
  })
})
