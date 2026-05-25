/**
 * Profil `localeSettings.dateFormat` date-fns sözdizimindedir (dd, MM, yyyy).
 * AntDV DatePicker dayjs kullanır — token eşlemesi gerekir.
 */
export function profileDateFormatToDayjs(profileFormat: string): string {
  return profileFormat
    .replace(/yyyy/g, 'YYYY')
    .replace(/yy/g, 'YY')
    .replace(/dd/g, 'DD')
}
