import type { AiContextExportFormat } from '@/core/services/ai-context-export/types'
import { buildAiContextDocument, type BuildAiContextDocumentParams } from '@/core/services/ai-context-export/build-document'
import { formatAiContextJson } from '@/core/services/ai-context-export/format-json'
import { formatAiContextMarkdown } from '@/core/services/ai-context-export/format-markdown'
import type { AiContextDocument } from '@/core/services/ai-context-export/types'

export type { AiContextDocument, AiContextExportFormat, BuildAiContextDocumentParams }

export function buildAndFormatAiContext(
  params: BuildAiContextDocumentParams,
  format: AiContextExportFormat,
): { document: AiContextDocument; text: string } {
  const document = buildAiContextDocument(params)
  const text = formatAiContextText(document, format)
  return { document, text }
}

export function formatAiContextText(
  document: AiContextDocument,
  format: AiContextExportFormat,
): string {
  switch (format) {
    case 'json':
      return formatAiContextJson(document)
    case 'markdown':
      return formatAiContextMarkdown(document)
  }
}

export { buildAiContextDocument }
