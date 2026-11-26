import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cardTypeLabel, ratingLabel } from '../domain/constants.ts'
import { dayKey, formatFullDate, formatTime } from '../domain/time.ts'
import { dayDetail, monthMatrix, type ScheduledItem } from '../services/stats/calendar.ts'
import { computeStats } from '../services/stats/stats.ts'
import { useSnapshot } from '../ui/useSnapshot.ts'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const KIND: Record<ScheduledItem['kind'], string> = {
  overdue: '逾期',
  due: '今天到期',
  upcoming: '已排期',
  missed: '仍未复习',
}

export function CalendarPage() {
  const snapshot = useSnapshot()
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  if (!snapshot) return null
  const now = new Date()
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = monthMatrix(year, month)
  const stats = computeStats({ cards: snapshot.cards, records: snapshot.records, logs: snapshot.logs, now })
  const remainingNew = Math.max(0, snapshot.settings.dailyNewLimit - stats.introducedToday)
  const detail = dayDetail({
    day: selected,
    now,
    cards: snapshot.cards,
    records: snapshot.records,
    logs: snapshot.logs,
    remainingNew,
  })
  const badges = new Map<string, { due: number; done: number; intro: boolean }>()
  for (const cell of cells) {
    const info = dayDetail({
      day: cell,
      now,
      cards: snapshot.cards,
      records: snapshot.records,
      logs: snapshot.logs,
      remainingNew,
    })
    badges.set(info.key, {
      due: info.scheduled.length,
      done: info.completed.length,
      intro: info.introductions.length > 0,
    })
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>日历</h1>
          <p className="lede">格子上的数字来自真实排程：未来是到期日，今天含逾期，过去是当天完成的复习。</p>
        </div>
      </div>
      <div className="calendar-layout">
        <div className="panel calendar-panel">
          <div className="calendar-head">
            <button type="button" className="btn small ghost" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="上个月">
              上个月
            </button>
            <strong>{year}年{month + 1}月</strong>
            <button type="button" className="btn small ghost" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="下个月">
              下个月
            </button>
          </div>
          <button
            type="button"
            className="btn small ghost today-jump"
            onClick={() => {
              const today = new Date()
              setCursor(today)
              setSelected(today)
            }}
          >
            回到今天
          </button>
          <div className="weekday-row">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="cal-grid">
            {cells.map((cell) => {
              const key = dayKey(cell)
              const info = badges.get(key)
              const inMonth = cell.getMonth() === month
              const isToday = key === dayKey(now)
              const isSelected = key === dayKey(selected)
              return (
                <button
                  key={key}
                  type="button"
                  className={['cal-cell', !inMonth && 'out', isToday && 'today', isSelected && 'selected'].filter(Boolean).join(' ')}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(cell)}
                >
                  <span>{cell.getDate()}</span>
                  {info && info.due > 0 && <b>{info.due}</b>}
                  {info && info.due === 0 && info.done > 0 && <i className="dot done" />}
                  {info && info.due === 0 && info.done === 0 && info.intro && <i className="dot" />}
                </button>
              )
            })}
          </div>
        </div>
        <div className="panel day-detail">
          <h2>{formatFullDate(selected)}</h2>
          {detail.scheduled.length === 0 && detail.completed.length === 0 && detail.introductions.length === 0 && (
            <p className="muted">这一天没有排期，也没有完成的复习。</p>
          )}
          {detail.scheduled.length > 0 && (
            <>
              <h3>排期</h3>
              <ul className="plain-list">
                {detail.scheduled.map((item) => (
                  <li key={`${item.kind}-${item.cardId}`}>
                    <Link to={`/cards/${item.cardId}`} lang="en">{item.front}</Link>
                    <span>{cardTypeLabel(item.type)} · {KIND[item.kind]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {detail.introductions.length > 0 && (
            <>
              <h3>今天可以认识的新卡片</h3>
              <p className="muted">新卡片不会预先排到以后的日期，只占今天剩下的名额。</p>
              <ul className="plain-list">
                {detail.introductions.map((item) => (
                  <li key={item.cardId}>
                    <Link to={`/cards/${item.cardId}`} lang="en">{item.front}</Link>
                    <span>{cardTypeLabel(item.type)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {detail.completed.length > 0 && (
            <>
              <h3>当天完成</h3>
              <ul className="plain-list">
                {detail.completed.map((item) => (
                  <li key={item.logId}>
                    <Link to={`/cards/${item.cardId}`} lang="en">{item.front}</Link>
                    <span>{formatTime(new Date(item.at))} · {ratingLabel(item.rating)} · {item.source === 'exercise' ? '练习' : '闪卡'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
