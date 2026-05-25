function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Güvenli HTML çıktısı: önce kaçış, sonra token sınıfları.
 * Yalnızca güvenilir (uygulama üretimi) JSON metni için kullanın.
 */
export function highlightJson(json: string): string {
  const escaped = escapeHtml(json)
  return escaped.replace(
    /"(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, colonSuffix: string | undefined) => {
      if (colonSuffix) {
        return `<span class="kp-json__key">${match}</span>`
      }
      if (match.startsWith('"')) {
        return `<span class="kp-json__string">${match}</span>`
      }
      if (match === 'true' || match === 'false') {
        return `<span class="kp-json__boolean">${match}</span>`
      }
      if (match === 'null') {
        return `<span class="kp-json__null">${match}</span>`
      }
      return `<span class="kp-json__number">${match}</span>`
    },
  )
}
