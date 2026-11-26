import { Link } from 'react-router-dom'
import { MASTERED_STABILITY_DAYS, ratingLabel } from '../domain/constants.ts'
import { formatDateTime, formatPercent } from '../domain/time.ts'
import { computeStats } from '../services/stats/stats.ts'
import { useSnapshot } from '../ui/useSnapshot.ts'

export function ProgressPage() {
  const snapshot = useSnapshot()
  if (!snapshot) return null
  const stats = computeStats({
    cards: snapshot.cards,
    records: snapshot.records,
    logs: snapshot.logs,
    now: new Date(),
  })
  const max = Math.max(1, ...stats.last14.map((day) => day.count))

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>进展</h1>
          <p className="lede">
            已掌握指回忆排程进入复习阶段，且稳定度至少 {MASTERED_STABILITY_DAYS} 天。识别练习和改写练习另计，不会把一张卡标成已掌握。
          </p>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat"><b>{stats.streak}</b><span>连续天数</span></div>
        <div className="stat"><b>{stats.longestStreak}</b><span>最长连续</span></div>
        <div className="stat"><b>{formatPercent(stats.accuracy)}</b><span>闪卡正确率</span></div>
        <div className="stat"><b>{formatPercent(stats.accuracyWeek)}</b><span>近 7 天闪卡</span></div>
      </div>
      <section className="panel">
        <h2>近 14 天</h2>
        <div className="bars bars-14" aria-label="近 14 天的学习次数">
          {stats.last14.map((day) => (
            <div key={day.key} className="bar">
              <div className="bar-fill" style={{ height: day.count === 0 ? 0 : `${Math.max(8, (day.count / max) * 100)}%` }} />
              <span>{day.count}</span>
              <small>{day.label}</small>
            </div>
          ))}
        </div>
        <p className="muted">正确率只看闪卡里的良好和容易。练习如果有标准答案，正确率是 {formatPercent(stats.exerciseAccuracy)}。</p>
      </section>
      <section className="panel">
        <h2>按类型</h2>
        {stats.byType.length === 0 ? (
          <p className="muted">还没有词卡。</p>
        ) : (
          <ul className="type-list">
            {stats.byType.map((item) => (
              <li key={item.type}>
                <div className="row">
                  <strong>{item.label}</strong>
                  <span className="muted">{item.total} 张 · {item.reviews > 0 ? formatPercent(item.accuracy) : '还没复习'}</span>
                </div>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${Math.round((item.accuracy ?? 0) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {stats.weak.length > 0 && (
          <p>需要再看的类型：{stats.weak.map((item) => `${item.label}（${item.reviews} 次，${formatPercent(item.accuracy)}）`).join('，')}。</p>
        )}
      </section>
      <section className="panel">
        <h2>最近的记录</h2>
        {stats.recent.length === 0 ? (
          <p className="muted">复习之后，这里会留下时间、评分和卡片。</p>
        ) : (
          <ul className="plain-list">
            {stats.recent.map((item) => (
              <li key={item.id}>
                <Link to={`/cards/${item.cardId}`} lang="en">{item.front}</Link>
                <span>
                  {formatDateTime(new Date(item.reviewedAt))} · {ratingLabel(item.rating)} · {item.source === 'exercise' ? '练习' : '闪卡'}
                  {typeof item.correct === 'boolean' ? (item.correct ? ' · 答对' : ' · 答错') : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
