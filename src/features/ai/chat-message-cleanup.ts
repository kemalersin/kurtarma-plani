import type { ChatMessage } from '@/core/types/ai'
import { extractProposalBundles } from '@/features/ai/proposals/parse'

/** İçeriksiz asistan balonu (proposal yok). */
export function isEmptyAssistantMessage(msg: ChatMessage): boolean {
  if (msg.role !== 'assistant') return false
  if (msg.content.trim()) return false
  return extractProposalBundles(msg.content).length === 0
}

/** Sondaki boş asistan mesajlarını kaldırır (yarım kalan / durdurulan yanıtlar). */
export function pruneTrailingEmptyAssistantMessages(messages: ChatMessage[]): ChatMessage[] {
  const result = [...messages]
  while (result.length > 0) {
    const last = result[result.length - 1]
    if (!last || !isEmptyAssistantMessage(last)) break
    result.pop()
  }
  return result
}
