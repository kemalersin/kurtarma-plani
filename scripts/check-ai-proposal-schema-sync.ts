import { collectProposalSchemaDrift, buildProposalTypeTable } from '@/features/ai/proposals/schema-meta'

const drift = collectProposalSchemaDrift()

if (drift.length) {
  console.error('AI proposal şema drift tespit edildi:\n')
  for (const line of drift) console.error(`  - ${line}`)
  process.exit(1)
}

console.log('AI proposal şemaları senkron.')
console.log('')
console.log(buildProposalTypeTable())
