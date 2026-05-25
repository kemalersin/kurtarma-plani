import { prunePaidInstallments } from '@/core/services/ai-context-export/prune-structured'
import type { AiContextDocument } from '@/core/services/ai-context-export/types'

export function formatAiContextJson(doc: AiContextDocument): string {
  return JSON.stringify(prunePaidInstallments(doc), null, 2)
}
