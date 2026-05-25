/** Benzersiz profil adı: "Ad", "Ad 2", "Ad 3" … */
export function resolveUniqueProfileName(baseName: string, existingNames: readonly string[]): string {
  const trimmed = baseName.trim() || 'Profil'
  const taken = new Set(existingNames.map((n) => n.trim()))
  if (!taken.has(trimmed)) return trimmed
  let suffix = 2
  while (taken.has(`${trimmed} ${suffix}`)) suffix += 1
  return `${trimmed} ${suffix}`
}
