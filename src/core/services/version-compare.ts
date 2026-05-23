/** Semver-style version comparison (major.minor.patch). */

export function normalizeVersionTag(raw: string): string {
  return raw.trim().replace(/^v/i, '')
}

function parseVersionParts(version: string): [number, number, number] {
  const normalized = normalizeVersionTag(version)
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(normalized)
  if (!match) return [0, 0, 0]
  return [
    Number(match[1] ?? 0),
    Number(match[2] ?? 0),
    Number(match[3] ?? 0),
  ]
}

/** Returns positive if `remote` is newer than `local`. */
export function isRemoteVersionNewer(local: string, remote: string): boolean {
  return compareVersions(local, remote) < 0
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersionParts(a)
  const pb = parseVersionParts(b)
  for (let i = 0; i < 3; i += 1) {
    if (pa[i]! > pb[i]!) return 1
    if (pa[i]! < pb[i]!) return -1
  }
  return 0
}
