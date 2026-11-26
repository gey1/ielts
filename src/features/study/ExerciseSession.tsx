import { useState } from 'react'
import { RATING_LABELS } from '../../domain/constants.ts'
import type { ReviewGrade } from '../../domain/types.ts'
import { gradeBuilt, type BuiltExercise } from '../../services/exercises/select.ts'
import { applyReview } from '../../services/srs/repository.ts'
import { messageOf } from '../../ui/download.ts'

export function ExerciseSession({
  items,
  onDone,
}: {
  items: BuiltExercise[]
  onDone: (summary: { correct: number; incorrect: number; rated: number }) => void
}) {
  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState('')
  const [picked, setPicked] = useState('')
  const [feedback, setFeedback] = useState<{ correct: boolean; feedback: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const item = items[index]

  if (!item) {
    return (
      <div className="card-sheet">
        <p>这一轮没有可做的练习。</p>
        <button type="button" className="btn primary" onClick={() => onDone({ correct: correctCount, incorrect: incorrectCount, rated: index })}>
          完成
        </button>
      </div>
    )
  }

  function revealModel() {
    setFeedback({ correct: false, feedback: item.modelAnswer })
  }

  function check() {
    const answer = item.type === 'recognition' ? picked : response
    if (!answer.trim()) {
      setError(item.type === 'recognition' ? '先选一个。' : '先写一点。')
      return
    }
    setError('')
    const result = gradeBuilt(item, answer)
    setFeedback(result)
    if (item.objective) {
      if (result.correct) setCorrectCount((count) => count + 1)
      else setIncorrectCount((count) => count + 1)
    }
  }

  async function commit(grade: ReviewGrade) {
    if (!feedback || busy) return
    const storedGrade: ReviewGrade = item.objective && !feedback.correct ? 1 : grade
    setBusy(true)
    setError('')
    try {
      await applyReview({
        cardId: item.cardId,
        skill: item.skill,
        grade: storedGrade,
        source: 'exercise',
        exerciseType: item.type,
        correct: item.objective ? feedback.correct : undefined,
      })
      const next = index + 1
      if (next >= items.length) {
        onDone({
          correct: correctCount,
          incorrect: incorrectCount,
          rated: next,
        })
        return
      }
      setIndex(next)
      setResponse('')
      setPicked('')
      setFeedback(null)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const objectiveWrong = Boolean(feedback && item.objective && !feedback.correct)
  const long = item.type === 'paraphrase' || item.type === 'sentence'

  return (
    <div className="study-wrap">
      <p className="kicker">
        练习 {index + 1} / {items.length}
        <span> · {labelOf(item.type)}</span>
      </p>
      <article className="card-sheet">
        <p className="prompt" data-testid="exercise-prompt" lang={item.type === 'translate' ? 'zh-CN' : 'en'}>
          {item.prompt}
        </p>
        {item.detail && <p className="detail" lang="en">{item.detail}</p>}
        {!feedback && item.type === 'recognition' && (
          <div className="choices">
            {item.choices?.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={picked === choice.id ? 'choice on' : 'choice'}
                lang="en"
                onClick={() => setPicked(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
        {!feedback && item.type !== 'recognition' && (
          long ? (
            <textarea
              data-testid="exercise-input"
              lang="en"
              rows={5}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="写在这里"
            />
          ) : (
            <input
              data-testid="exercise-input"
              lang="en"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') check()
              }}
              placeholder="写在这里"
            />
          )
        )}
        {error && <p className="error">{error}</p>}
        {!feedback && (
          <div className="form-actions">
            <button type="button" className="btn primary" data-testid="exercise-check" onClick={item.objective ? check : revealModel}>
              {item.objective ? '核对' : '查看参考'}
            </button>
          </div>
        )}
        {feedback && (
          <div className={item.objective ? (feedback.correct ? 'feedback ok' : 'feedback bad') : 'feedback'} data-testid="exercise-feedback">
            <p>{item.objective ? feedback.feedback : '参考'}</p>
            {!item.objective && <p lang="en" className="model">{feedback.feedback}</p>}
            {item.objective && feedback.correct && <p lang="en" className="model">{item.modelAnswer}</p>}
          </div>
        )}
      </article>
      {feedback && (
        <div className="rate-block">
          {objectiveWrong ? (
            <>
              <p className="muted">这题未答对，会按「重来」记入这项技能，不会把它算成掌握。</p>
              <button type="button" className="btn primary" data-testid="rate-1" disabled={busy} onClick={() => void commit(1)}>
                记为重来，继续
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                {item.skill === 'recall'
                  ? '按真实把握评分。这次会更新这张卡的回忆排程。'
                  : '按真实把握评分。这项练习不把「认出」或「写过一次」算成掌握。'}
              </p>
              <div className="rate">
                {([1, 2, 3, 4] as ReviewGrade[]).map((grade) => (
                  <button key={grade} type="button" className={`rate-${grade}`} data-testid={`rate-${grade}`} disabled={busy} onClick={() => void commit(grade)}>
                    <strong>{RATING_LABELS[grade]?.zh}</strong>
                    <span>{RATING_LABELS[grade]?.en}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function labelOf(type: BuiltExercise['type']): string {
  const labels: Record<BuiltExercise['type'], string> = {
    recognition: '识别',
    recall: '回忆',
    cloze: '填空',
    translate: '中译英',
    paraphrase: '改写',
    sentence: '造句',
  }
  return labels[type]
}
