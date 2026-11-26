import type { StudyMode } from '../domain/types.ts'

export function ModeSwitch({ mode, onChange }: { mode: StudyMode; onChange: (mode: StudyMode) => void }) {
  return (
    <div className="segmented" role="tablist" aria-label="学习模式">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'programme'}
        data-testid="mode-programme"
        onClick={() => onChange('programme')}
      >
        按计划学习
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'review'}
        data-testid="mode-review"
        onClick={() => onChange('review')}
      >
        只复习到期
      </button>
    </div>
  )
}
