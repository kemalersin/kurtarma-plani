import {
  expandProposalItems,
  parseProposalBundle,
} from '@/features/ai/proposals/schema'
import type { AiProposalBundle } from '@/features/ai/proposals/types'

const FENCE_RE = /```([\w-]*)\s*\n([\s\S]*?)```/g

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text.trim())
  } catch {
    return null
  }
}

function bundleFromRaw(raw: unknown): AiProposalBundle | null {
  const parsed = parseProposalBundle(raw)
  if (!parsed) return null
  return {
    version: 1,
    items: expandProposalItems(parsed.items),
  }
}

/** Asistan mesajından tüm geçerli proposal bloklarını çıkarır. */
export function extractProposalBundles(source: string): AiProposalBundle[] {
  const bundles: AiProposalBundle[] = []
  const seen = new Set<string>()

  for (const match of source.matchAll(FENCE_RE)) {
    const lang = (match[1] ?? '').toLowerCase()
    const body = match[2] ?? ''
    if (lang !== 'kp-proposals' && lang !== 'json') continue
    const raw = tryParseJson(body)
    const bundle = bundleFromRaw(raw)
    if (!bundle) continue
    const key = JSON.stringify(bundle)
    if (seen.has(key)) continue
    seen.add(key)
    bundles.push(bundle)
  }

  return bundles
}

/** Proposal JSON bloklarını markdown görünümünden kaldırır. */
export function stripProposalBlocks(source: string): string {
  return source
    .replace(FENCE_RE, (full, lang: string, body: string) => {
      const normalized = lang.toLowerCase()
      if (normalized === 'kp-proposals') return ''
      if (normalized === 'json' && bundleFromRaw(tryParseJson(body))) return ''
      return full
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
