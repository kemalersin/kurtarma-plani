import type { StyleValue } from 'vue'

export type LocalePickerShellAttrs = {
  style?: StyleValue
  class?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}

/** Mobil tetikleyicide kullanılmayan; yalnızca AntDV picker'a giden attrs. */
const MOBILE_TRIGGER_ATTR_KEYS = new Set([
  'disabled',
  'allowClear',
  'placeholder',
  'mobileTitle',
  'size',
  'style',
  'class',
])

/** Dış kabuk (DatePicker / mobil tetikleyici) — `style`, `class` vb. */
export function localePickerShellAttrs(attrs: Record<string, unknown>): LocalePickerShellAttrs {
  const shell: LocalePickerShellAttrs = {}
  if (attrs.style != null) shell.style = attrs.style as StyleValue
  if (attrs.class != null) {
    shell.class = attrs.class as NonNullable<LocalePickerShellAttrs['class']>
  }
  return shell
}

function pickerAttrKey(key: string): string {
  return key === 'disabled-date' ? 'disabledDate' : key
}

/** Masaüstü DatePicker ile aynı bind — mobil panelde birebir aktarım. */
export function localePickerBindFromAttrs(
  attrs: Record<string, unknown>,
  format: string,
): Record<string, unknown> {
  const bind: Record<string, unknown> = { format }
  for (const key of Object.keys(attrs)) {
    if (MOBILE_TRIGGER_ATTR_KEYS.has(key)) continue
    bind[pickerAttrKey(key)] = attrs[key]
  }
  return bind
}

export function readDisabledDateFromBind(
  bind: Record<string, unknown>,
): ((current: import('dayjs').Dayjs) => boolean) | undefined {
  const raw = bind.disabledDate ?? bind['disabled-date']
  if (typeof raw !== 'function') return undefined
  return raw as (current: import('dayjs').Dayjs) => boolean
}
