import { describe, expect, it } from 'vitest'
import {
  chatSessionStorageId,
  resolveAiChatKey,
  resolveAiChatPlaceholder,
  shouldShowAiChatFab,
} from '@/features/ai/page-chat'

function routeLike(
  name: string,
  query: Record<string, string> = {},
): { name: string; query: Record<string, string | string[]> } {
  return { name, query }
}

describe('page-chat', () => {
  it('chatSessionStorageId prefixes chat key', () => {
    expect(chatSessionStorageId('home')).toBe('chat:home')
    expect(chatSessionStorageId('debts:loans')).toBe('chat:debts:loans')
  })

  it('resolveAiChatKey includes tab query when present', () => {
    expect(resolveAiChatKey(routeLike('debts', { tab: 'loans' }) as never)).toBe('debts:loans')
    expect(resolveAiChatKey(routeLike('home') as never)).toBe('home')
  })

  it('resolveAiChatPlaceholder returns tab-specific hint', () => {
    const hint = resolveAiChatPlaceholder(routeLike('debts', { tab: 'loans' }) as never)
    expect(hint).toContain('Kredi taksit')
  })

  it('shouldShowAiChatFab hides on full AI page', () => {
    expect(shouldShowAiChatFab(routeLike('ai') as never)).toBe(false)
    expect(shouldShowAiChatFab(routeLike('home') as never)).toBe(true)
  })
})
