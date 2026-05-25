/**
 * Anthropic kısa alias'ları → sabit snapshot ID.
 * @see https://platform.claude.com/docs/en/about-claude/models/overview
 */
const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  'claude-opus-4-0': 'claude-opus-4-20250514',
  'claude-sonnet-4-0': 'claude-sonnet-4-20250514',
  'claude-opus-4-1': 'claude-opus-4-1-20250805',
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
}

/** API çağrısı öncesi model kimliğini sabit snapshot'a çevirir. */
export function resolveAnthropicModelId(modelId: string): string {
  const trimmed = modelId.trim()
  return ANTHROPIC_MODEL_ALIASES[trimmed] ?? trimmed
}
