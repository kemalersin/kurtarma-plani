const HEX6 = /^#?[0-9A-Fa-f]{6}$/

/** Geçerli #RRGGBB döndürür; aksi halde undefined. */
export function normalizeHexColor(value: string | undefined | null): string | undefined {
  if (!value?.trim()) return undefined
  const raw = value.trim()
  if (raw.startsWith('#')) {
    return HEX6.test(raw) ? raw.toLowerCase() : undefined
  }
  return HEX6.test(raw) ? `#${raw.toLowerCase()}` : undefined
}

/** `<input type="color">` için her zaman #RRGGBB (boşsa varsayılan). */
export function hexForColorInput(value: string | undefined | null, fallback = '#1677ff'): string {
  return normalizeHexColor(value) ?? fallback
}
