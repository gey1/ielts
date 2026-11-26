import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExerciseSession } from '../features/study/ExerciseSession.tsx'
import { cardTypeLabel, RATING_LABELS } from '../domain/constants.ts'
import type { ReviewGrade, StudyMode } from '../domain/types.ts'
import { dayKey } from '../domain/time.ts'
import { programmeExercises, type BuiltExercise, type ExerciseCard } from '../services/exercises/select.ts'
import { setStudyMode } from '../services/library/library.ts'
import { indexSnapshot, loadSnapshot, type Snapshot } from '../services/library/snapshot.ts'
import { previewIntervals } from '../services/srs/engine.ts'
import { applyReview } from '../services/srs/repository.ts'
import { buildStudyQueue, countIntroducedOn, type QueueCard } from '../services/study/queue.ts'
import { BlocksView } from '../ui/BlocksView.tsx'
import { messageOf } from '../ui/download.ts'
import { ModeSwitch } from '../ui/ModeSwitch.tsx'
import { useIndexed, useSnapshot } from '../ui/useSnapshot.ts'

type Phase = 'loading' | 'cards' | 'bridge' | 'exercises' | 'done' | 'empty'

interface RoundStats {
  again: number
  hard: number
  good: number
  easy: number
}

export function StudyPage() {
  const snapshot = useSnapshot()
  const indexed = useIndexed(snapshot)
  const [nonce, setNonce] = useState(0)
  const [queue, setQueue] = useState<string[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<RoundStats>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [exercises, setExercises] = useState<BuiltExercise[]>([])
  const [exerciseSummary, setExerciseSummary] = useState<{ correct: number; incorrect: number; rated: number } | null>(null)
  const mode = snapshot?.settings.studyMode ?? 'programme'

  useEffect(() => {
    let cancel = false
    setPhase('loading')
    setQueue(null)
    void loadSnapshot().then((fresh) => {
      if (cancel) return
      const ids = queueFrom(fresh)
      const exerciseCards = toExerciseCards(fresh)
      const states = new Map(fresh.records.filter((record) => record.skill === 'recall').map((record) => [record.cardId, record.state]))
      setStats({ again: 0, hard: 0, good: 0, easy: 0 })
      setExerciseSummary(null)
      setIndex(0)
      setRevealed(false)
      setQueue(ids)
      if (ids.length === 0) {
        if (fresh.settings.studyMode === 'programme') {
          const built = programmeExercises({
            sessionIds: [],
            cards: exerciseCards,
            states,
            limit: fresh.settings.dailyExerciseLimit,
            seed: Date.now() % 100000,
          })
          if (built.length > 0) {
            setExercises(built)
            setPhase('bridge')
            return
          }
        }
        setExercises([])
        setPhase('empty')
        return
      }
      setExercises([])
      setPhase('cards')
    })
    return () => {
      cancel = true
    }
  }, [mode, nonce])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (phase !== 'cards' || busy) return
      if (event.key === ' ' && !revealed) {
        event.preventDefault()
        setRevealed(true)
      }
      const grades: Record<string, ReviewGrade> = { '1': 1, '2': 2, '3': 3, '4': 4 }
      const grade = grades[event.key]
      if (revealed && grade) void rate(grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const cardId = queue?.[index]
  const card = snapshot?.cards.find((item) => item.id === cardId)
  const blocks = card && indexed ? indexed.blocksByCard.get(card.id) ?? [] : []
  const record = card && indexed ? indexed.recallByCard.get(card.id) ?? null : null
  const intervals = useMemo(() => (phase === 'cards' ? previewIntervals(record ?? null, new Date()) : []), [phase, record])

  async function changeMode(next: StudyMode) {
    if (next === mode) return
    await setStudyMode(next)
  }

  async function rate(grade: ReviewGrade) {
    if (!card || busy) return
    setBusy(true)
    setError('')
    try {
      await applyReview({ cardId: card.id, skill: 'recall', grade, source: 'flashcard' })
      setStats((current) => ({
        again: current.again + (grade === 1 ? 1 : 0),
        hard: current.hard + (grade === 2 ? 1 : 0),
        good: current.good + (grade === 3 ? 1 : 0),
        easy: current.easy + (grade === 4 ? 1 : 0),
      }))
      const nextIndex = index + 1
      if (!queue || nextIndex >= queue.length) {
        if (mode === 'programme' && snapshot) {
          const fresh = await loadSnapshot()
          const built = programmeExercises({
            sessionIds: queue ?? [],
            cards: toExerciseCards(fresh),
            states: new Map(fresh.records.filter((item) => item.skill === 'recall').map((item) => [item.cardId, item.state])),
            limit: fresh.settings.dailyExerciseLimit,
            seed: Date.now() % 100000,
          })
          if (built.length > 0) {
            setExercises(built)
            setPhase('bridge')
            return
          }
        }
        setPhase('done')
        return
      }
      setIndex(nextIndex)
      setRevealed(false)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) return null

  return (
    <section className="page study-page">
      <div className="page-head">
        <div>
          <h1>学习</h1>
          <p className="lede">按计划会带上新卡片和到期复习，最后做几道要自己写出来的练习。只复习则不加入新内容。</p>
        </div>
      </div>
      <ModeSwitch mode={mode} onChange={(next) => void changeMode(next)} />
      <p className="practice-link">
        <Link to="/practice">专项练习</Link>
        <span className="muted">识别、填空、改写可以分开练。识别不计入掌握。</span>
      </p>

      {phase === 'loading' && <p className="muted">正在准备这一轮…</p>}

      {phase === 'empty' && (
        <div className="empty">
          <h2>{mode === 'review' ? '没有到期的卡片' : '这一轮没有要学的内容'}</h2>
          {mode === 'review' ? (
            <p>到期的复习做完了。新卡片在「按计划学习」里，不会混进这个模式。</p>
          ) : (
            <p>没有到期复习，也没有还能引入的新卡片。可以添加词卡，或把每日新卡数量调高一点。</p>
          )}
          <div className="cluster">
            {mode === 'review' && (
              <button type="button" className="btn primary" onClick={() => void changeMode('programme')}>
                切换到按计划学习
              </button>
            )}
            <Link className="btn ghost" to="/cards/new">新建词卡</Link>
            <Link className="btn ghost" to="/import">导入 JSON</Link>
          </div>
        </div>
      )}

      {phase === 'cards' && card && (
        <div className="study-wrap">
          <p className="kicker">
            第 {index + 1} / {queue?.length ?? 0} 张
            <span> · {record && record.state !== 0 ? '复习' : '新卡片'}</span>
          </p>
          <article className="card-sheet">
            <p className="type-line">
              <span>{cardTypeLabel(card.type)}</span>
              <CollectionLine snapshot={snapshot} cardId={card.id} />
            </p>
            <h2 className={card.frontText.length > 48 ? 'front long' : 'front'} lang="en" data-testid="study-front">
              {card.frontText}
            </h2>
            <BlocksView blocks={blocks} backText={card.backText} side="front" />
            {!revealed && (
              <button type="button" className="btn primary reveal" data-testid="reveal" onClick={() => setRevealed(true)}>
                显示答案
              </button>
            )}
            {revealed && (
              <div className="answer">
                {card.backText && (
                  <p className="back-text" lang="zh-CN">{card.backText}</p>
                )}
                <BlocksView blocks={blocks} backText={card.backText} side="back" />
              </div>
            )}
          </article>
          {error && <p className="error">{error}</p>}
          {revealed && (
            <div className="rate" aria-label="评分">
              {intervals.map((choice) => (
                <button
                  key={choice.grade}
                  type="button"
                  className={`rate-${choice.grade}`}
                  data-testid={`rate-${choice.grade}`}
                  disabled={busy}
                  onClick={() => void rate(choice.grade)}
                >
                  <strong>{RATING_LABELS[choice.grade]?.zh}</strong>
                  <span>{RATING_LABELS[choice.grade]?.en}</span>
                  <em>{choice.label}</em>
                </button>
              ))}
            </div>
          )}
          <p className="kbd-hint muted">空格显示答案，1 到 4 评分。</p>
        </div>
      )}

      {phase === 'cards' && !card && queue && queue.length > 0 && (
        <div className="empty">
          <p>这张卡片已经不在词库里。</p>
          <button type="button" className="btn ghost" onClick={() => setNonce((value) => value + 1)}>重新开始这一轮</button>
        </div>
      )}

      {phase === 'bridge' && (
        <div className="empty">
          <h2>闪卡这一段结束了</h2>
          <p>接下来 {exercises.length} 道产出练习：填空、翻译、改写或造句。识别题不在计划里，因为认出单词不算掌握。</p>
          <div className="cluster">
            <button type="button" className="btn primary" onClick={() => setPhase('exercises')}>开始练习</button>
            <button type="button" className="btn ghost" onClick={() => setPhase('done')}>跳过练习</button>
          </div>
        </div>
      )}

      {phase === 'exercises' && (
        <ExerciseSession
          items={exercises}
          onDone={(summary) => {
            setExerciseSummary(summary)
            setPhase('done')
          }}
        />
      )}

      {phase === 'done' && (
        <div className="empty">
          <h2>这一轮结束了</h2>
          <p>
            闪卡 {stats.again + stats.hard + stats.good + stats.easy} 张
            {stats.again + stats.hard + stats.good + stats.easy > 0 && `：重来 ${stats.again}，困难 ${stats.hard}，良好 ${stats.good}，容易 ${stats.easy}`}
            。
          </p>
          {exerciseSummary && exerciseSummary.rated > 0 && (
            <p>
              练习 {exerciseSummary.rated} 道
              {exerciseSummary.correct + exerciseSummary.incorrect > 0 &&
                `，其中客观题答对 ${exerciseSummary.correct}、答错 ${exerciseSummary.incorrect}`}
              。
            </p>
          )}
          <div className="cluster">
            <Link className="btn primary" to="/">回到今日</Link>
            <button type="button" className="btn ghost" onClick={() => setNonce((value) => value + 1)}>再来一轮</button>
          </div>
        </div>
      )}
    </section>
  )
}

function CollectionLine({ snapshot, cardId }: { snapshot: Snapshot; cardId: string }) {
  const names = snapshot.cardCollections
    .filter((link) => link.cardId === cardId)
    .map((link) => snapshot.collections.find((item) => item.id === link.collectionId)?.name)
    .filter((name): name is string => Boolean(name))
  if (names.length === 0) return null
  return <span className="muted">{names.join(' · ')}</span>
}

function queueFrom(snapshot: Snapshot): string[] {
  const recall = new Map(snapshot.records.filter((record) => record.skill === 'recall').map((record) => [record.cardId, record]))
  const cards: QueueCard[] = snapshot.cards.map((card) => ({
    id: card.id,
    createdAt: card.createdAt,
    record: recall.get(card.id) ?? null,
  }))
  return buildStudyQueue(cards, {
    mode: snapshot.settings.studyMode,
    now: new Date(),
    dailyNewLimit: snapshot.settings.dailyNewLimit,
    introducedToday: countIntroducedOn(snapshot.logs, dayKey(new Date())),
  })
}

function toExerciseCards(snapshot: Snapshot): ExerciseCard[] {
  const index = indexSnapshot(snapshot)
  return snapshot.cards.map((card) => ({
    id: card.id,
    type: card.type,
    frontText: card.frontText,
    backText: card.backText,
    blocks: (index.blocksByCard.get(card.id) ?? []).map((block) => ({ type: block.type, content: block.content })),
  }))
}
