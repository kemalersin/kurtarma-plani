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
export function localePickerShellAttrs(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const shell: Record<string, unknown> = {}
  if (attrs.style != null) shell.style = attrs.style
  if (attrs.class != null) shell.class = attrs.class
  return shell
}

/** Masaüstü DatePicker ile aynı bind — mobil panelde birebir aktarım. */
export function localePickerBindFromAttrs(
  attrs: Record<string, unknown>,
  format: string,
): Record<string, unknown> {
  const bind: Record<string, unknown> = { format }
  for (const key of Object.keys(attrs)) {
    if (!MOBILE_TRIGGER_ATTR_KEYS.has(key)) {
      bind[key] = attrs[key]
    }
  }
  return bind
}

export function readDisabledDateFromBind(
  bind: Record<string, unknown>,
): ((current: import('dayjs').Dayjs) => boolean) | undefined {
  const raw = bind.disabledDate
  if (typeof raw !== 'function') return undefined
  return raw as (current: import('dayjs').Dayjs) => boolean
}
