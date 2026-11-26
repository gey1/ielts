import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExerciseSession } from '../features/study/ExerciseSession.tsx'
import {
  EXERCISE_META,
  EXERCISE_TYPES,
  practiceQueue,
  type BuiltExercise,
  type ExerciseCard,
  type ExerciseType,
} from '../services/exercises/select.ts'
import { indexSnapshot, loadSnapshot } from '../services/library/snapshot.ts'
import { isScheduledDue, SRS_NEW } from '../services/srs/engine.ts'

function isExerciseType(value: string | undefined): value is ExerciseType {
  return EXERCISE_TYPES.includes(value as ExerciseType)
}

export function PracticePage() {
  const { type } = useParams()
  const selected = isExerciseType(type) ? type : null
  const [items, setItems] = useState<BuiltExercise[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let cancel = false
    setFinished(false)
    setItems(null)
    void loadSnapshot().then((snapshot) => {
      if (cancel) return
      const cards = toCards(snapshot)
      const recall = snapshot.records.filter((record) => record.skill === 'recall')
      const now = new Date()
      const dueIds = recall.filter((record) => isScheduledDue(record, now)).map((record) => record.cardId)
      const learningIds = recall.filter((record) => record.state !== SRS_NEW).map((record) => record.cardId)
      const nextCounts: Record<string, number> = {}
      for (const kind of EXERCISE_TYPES) {
        nextCounts[kind] = practiceQueue({ type: kind, cards, dueIds, learningIds, limit: 1000, seed: 1 }).length
      }
      setCounts(nextCounts)
      if (selected) {
        setItems(practiceQueue({ type: selected, cards, dueIds, learningIds, limit: 10, seed: Date.now() % 100000 }))
      }
    })
    return () => {
      cancel = true
    }
  }, [selected])

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="kicker"><Link to="/study">学习</Link></p>
          <h1>{selected ? EXERCISE_META[selected].label : '专项练习'}</h1>
          <p className="lede">
            {selected
              ? EXERCISE_META[selected].blurb
              : '选一种练法。回忆会更新这张卡的复习日期；识别和运用只记在各自的技能上。'}
          </p>
        </div>
      </div>
      {!selected && (
        <ul className="practice-grid">
          {EXERCISE_TYPES.map((kind) => (
            <li key={kind}>
              <Link to={`/practice/${kind}`}>
                <strong>{EXERCISE_META[kind].label}</strong>
                <span>{EXERCISE_META[kind].blurb}</span>
                <small>{counts ? `${counts[kind] ?? 0} 张可练` : '…'}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {selected && !finished && items && items.length === 0 && (
        <div className="empty">
          <h2>现在做不了这种练习</h2>
          <p>可能是词卡太少，或这种练习需要例句、中文或改写卡。识别至少要有两张不同的卡。</p>
          <Link className="btn ghost" to="/practice">换一种</Link>
        </div>
      )}
      {selected && !finished && items && items.length > 0 && (
        <ExerciseSession items={items} onDone={() => setFinished(true)} />
      )}
      {selected && !items && <p className="muted">正在挑卡片…</p>}
      {finished && (
        <div className="empty">
          <h2>这组练习做完了</h2>
          <div className="cluster">
            <Link className="btn primary" to="/practice">返回练习列表</Link>
            <Link className="btn ghost" to="/study">去学习</Link>
          </div>
        </div>
      )}
    </section>
  )
}

function toCards(snapshot: Awaited<ReturnType<typeof loadSnapshot>>): ExerciseCard[] {
  const index = indexSnapshot(snapshot)
  return snapshot.cards.map((card) => ({
    id: card.id,
    type: card.type,
    frontText: card.frontText,
    backText: card.backText,
    blocks: (index.blocksByCard.get(card.id) ?? []).map((block) => ({ type: block.type, content: block.content })),
  }))
}
