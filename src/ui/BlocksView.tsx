import { blockLabel } from '../domain/constants.ts'
import type { ContentBlock } from '../domain/types.ts'

export function BlocksView({
  blocks,
  backText,
  side,
}: {
  blocks: ContentBlock[]
  backText: string
  side: 'front' | 'back'
}) {
  const shown = blocks.filter((block) => {
    if (!block.content.trim()) return false
    if (side === 'front') return block.type === 'pronunciation'
    if (block.type === 'pronunciation') return false
    if (block.type === 'translation' && block.content.trim() === backText.trim()) return false
    return true
  })
  if (shown.length === 0) return null
  return (
    <div className="blocks">
      {shown.map((block) => (
        <section key={block.id} className={block.type === 'pronunciation' ? 'ipa-block' : undefined}>
          <h3>{blockLabel(block.type)}</h3>
          <p lang={block.type === 'translation' ? 'zh-CN' : 'en'}>{block.content}</p>
        </section>
      ))}
    </div>
  )
}
