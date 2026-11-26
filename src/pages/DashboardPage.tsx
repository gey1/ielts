import { Link } from 'react-router-dom'
import { formatFullDate, formatPercent } from '../domain/time.ts'
import { setStudyMode } from '../services/library/library.ts'
import { computeStats } from '../services/stats/stats.ts'
import type { StudyMode } from '../domain/types.ts'
import { ModeSwitch } from '../ui/ModeSwitch.tsx'
import { useSnapshot } from '../ui/useSnapshot.ts'

export function DashboardPage() {
  const snapshot = useSnapshot()
  if (!snapshot) return null
  const now = new Date()
  const stats = computeStats({
    cards: snapshot.cards,
    records: snapshot.records,
    logs: snapshot.logs,
    now,
  })
  const hour = now.getHours()
  const hello = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const slots = Math.max(0, snapshot.settings.dailyNewLimit - stats.introducedToday)
  const introductions = snapshot.settings.studyMode === 'programme' ? Math.min(slots, stats.fresh) : 0
  const waiting = stats.due + introductions

  async function changeMode(mode: StudyMode) {
    await setStudyMode(mode)
  }

  let sentence = '今天计划里的卡片已经看过了。'
  if (snapshot.cards.length === 0) sentence = '词库还是空的。先导入一组示例，或自己写一张卡。'
  else if (waiting > 0) {
    const parts = [`今天有 ${stats.due} 张到期`]
    if (stats.overdue > 0) parts.push(`其中 ${stats.overdue} 张已逾期`)
    if (introductions > 0) parts.push(`还可以认识 ${introductions} 张新卡片`)
    sentence = `${parts.join('，')}。`
  }

  const max = Math.max(1, ...stats.last7.map((day) => day.count))

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="kicker">{formatFullDate(now)}</p>
          <h1>{hello}</h1>
          <p className="lede">{sentence}</p>
        </div>
      </div>
      <ModeSwitch mode={snapshot.settings.studyMode} onChange={(mode) => void changeMode(mode)} />
      <div className="cluster hero-actions">
        {snapshot.cards.length === 0 ? (
          <>
            <Link className="btn primary" to="/import">导入示例或 JSON</Link>
            <Link className="btn ghost" to="/cards/new">新建词卡</Link>
          </>
        ) : (
          <Link className="btn primary" to="/study">{waiting > 0 ? '开始学习' : '打开学习'}</Link>
        )}
      </div>
      <div className="stat-grid">
        <Stat value={String(stats.total)} label="全部词卡" />
        <Stat value={String(stats.mastered)} label="已掌握" />
        <Stat value={String(stats.learning)} label="学习中" />
        <Stat value={String(stats.due)} label="今日到期" />
      </div>
      <div className="split-panels">
        <section className="panel">
          <h2>近 7 天</h2>
          <div className="bars" aria-label="近 7 天的学习次数">
            {stats.last7.map((day) => (
              <div key={day.key} className="bar">
                <div className="bar-fill" style={{ height: day.count === 0 ? 0 : `${Math.max(8, (day.count / max) * 100)}%` }} />
                <span>{day.count}</span>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>连续学习</h2>
          <p className="streak">{stats.streak} <span>天</span></p>
          <p className="muted">最长 {stats.longestStreak} 天。今天学过就会算进连续天数；只差一天还不会断。</p>
          <p className="muted">
            {stats.accuracy === null ? '还没有闪卡评分。' : `闪卡正确率 ${formatPercent(stats.accuracy)}。`}
            良好和容易算对，重来和困难不算。
          </p>
          {stats.weak.length > 0 && (
            <p>较弱的类型：{stats.weak.map((item) => `${item.label} ${formatPercent(item.accuracy)}`).join('，')}。</p>
          )}
        </section>
      </div>
      {!snapshot.settings.lastBackupAt && snapshot.cards.length > 0 && (
        <p className="banner">
          学习记录只在这台设备上。导出一份备份，换浏览器或清除数据时才找得回来。
          <Link to="/settings">去备份</Link>
        </p>
      )}
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}
