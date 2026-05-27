import { describe, expect, it } from 'vitest'
import {
  isEmptyAssistantMessage,
  pruneTrailingEmptyAssistantMessages,
} from '@/features/ai/chat-message-cleanup'
import type { ChatMessage } from '@/core/types/ai'

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role' | 'content'>): ChatMessage {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('chat-message-cleanup', () => {
  it('isEmptyAssistantMessage detects blank assistant bubbles', () => {
    expect(isEmptyAssistantMessage(msg({ id: '1', role: 'assistant', content: '' }))).toBe(true)
    expect(isEmptyAssistantMessage(msg({ id: '2', role: 'assistant', content: '  ' }))).toBe(true)
    expect(isEmptyAssistantMessage(msg({ id: '3', role: 'user', content: '' }))).toBe(false)
    expect(isEmptyAssistantMessage(msg({ id: '4', role: 'assistant', content: 'Merhaba' }))).toBe(false)
  })

  it('pruneTrailingEmptyAssistantMessages removes trailing empty assistant only', () => {
    const messages = [
      msg({ id: 'u1', role: 'user', content: 'Soru' }),
      msg({ id: 'a1', role: 'assistant', content: 'Yanıt' }),
      msg({ id: 'u2', role: 'user', content: 'Devam' }),
      msg({ id: 'a2', role: 'assistant', content: '' }),
    ]
    const pruned = pruneTrailingEmptyAssistantMessages(messages)
    expect(pruned).toHaveLength(3)
    expect(pruned.at(-1)?.id).toBe('u2')
  })
})
