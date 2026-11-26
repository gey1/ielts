import { cardTypeLabel } from '../../domain/constants.ts'
import { addDays, dayKey, formatShortDay, startOfLocalDay } from '../../domain/time.ts'
import type { ReviewLog, SrsRecord } from '../../domain/types.ts'
import { isScheduledDue, masteryOf, SRS_NEW } from '../srs/engine.ts'
import { countIntroducedOn } from '../study/queue.ts'

export interface StatCard {
  id: string
  type: string
  frontText: string
  createdAt: string
}

export interface DayCount {
  key: string
  label: string
  count: number
}

export interface TypeStat {
  type: string
  label: string
  total: number
  reviews: number
  again: number
  accuracy: number | null
}

export interface RecentReview {
  id: string
  cardId: string
  front: string
  rating: number
  reviewedAt: string
  source: string
  exerciseType?: string
  correct?: boolean
}

export interface DashboardStats {
  total: number
  mastered: number
  learning: number
  fresh: number
  due: number
  overdue: number
  introducedToday: number
  reviewedToday: number
  accuracy: number | null
  accuracyWeek: number | null
  exerciseAccuracy: number | null
  streak: number
  longestStreak: number
  last7: DayCount[]
  last14: DayCount[]
  weak: { type: string; label: string; accuracy: number; reviews: number }[]
  byType: TypeStat[]
  recent: RecentReview[]
}

function accuracyOf(logs: ReviewLog[]): number | null {
  const graded = logs.filter((log) => log.rating >= 1 && log.rating <= 4)
  if (graded.length === 0) return null
  const good = graded.filter((log) => log.rating >= 3).length
  return good / graded.length
}

function activeDayKeys(logs: ReviewLog[]): Set<string> {
  const days = new Set<string>()
  for (const log of logs) {
    if (log.rating < 1 || log.rating > 4) continue
    if (log.source === 'manual' || log.source === 'reset') continue
    days.add(dayKey(new Date(log.reviewedAt)))
  }
  return days
}

export function currentStreak(days: Set<string>, now: Date): number {
  const cursor = startOfLocalDay(now)
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(dayKey(cursor))) return 0
  }
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function longestStreak(days: Set<string>): number {
  const keys = [...days].sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const key of keys) {
    if (!previous) run = 1
    else {
      const prevDate = new Date(`${previous}T00:00:00`)
      const nextDate = new Date(`${key}T00:00:00`)
      const diff = Math.round((nextDate.getTime() - prevDate.getTime()) / 86400000)
      run = diff === 1 ? run + 1 : 1
    }
    best = Math.max(best, run)
    previous = key
  }
  return best
}

export function computeStats(input: {
  cards: StatCard[]
  records: SrsRecord[]
  logs: ReviewLog[]
  now: Date
}): DashboardStats {
  const recall = input.records.filter((record) => record.skill === 'recall')
  const recallByCard = new Map(recall.map((record) => [record.cardId, record]))
  const cardById = new Map(input.cards.map((card) => [card.id, card]))
  let mastered = 0
  let learning = 0
  let fresh = 0
  let due = 0
  let overdue = 0
  const start = startOfLocalDay(input.now)
  for (const card of input.cards) {
    const record = recallByCard.get(card.id)
    const status = masteryOf(record)
    if (status === 'mastered') mastered += 1
    else if (status === 'learning') learning += 1
    else fresh += 1
    if (record && isScheduledDue(record, input.now)) {
      due += 1
      if (new Date(record.due).getTime() < start.getTime()) overdue += 1
    }
  }
  const flashLogs = input.logs.filter((log) => log.source === 'flashcard' && log.skill === 'recall')
  const today = dayKey(input.now)
  const weekStart = addDays(start, -6)
  const weekLogs = flashLogs.filter((log) => new Date(log.reviewedAt) >= weekStart)
  const objective = input.logs.filter((log) => log.source === 'exercise' && typeof log.correct === 'boolean')
  const exerciseAccuracy = objective.length
    ? objective.filter((log) => log.correct).length / objective.length
    : null
  const days = activeDayKeys(input.logs)
  const counts = new Map<string, number>()
  for (const key of days) counts.set(key, 0)
  for (const log of input.logs) {
    if (log.rating < 1 || log.rating > 4) continue
    if (log.source === 'manual' || log.source === 'reset') continue
    const key = dayKey(new Date(log.reviewedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const series = (length: number): DayCount[] => {
    const rows: DayCount[] = []
    for (let i = length - 1; i >= 0; i -= 1) {
      const date = addDays(start, -i)
      const key = dayKey(date)
      rows.push({ key, label: formatShortDay(date), count: counts.get(key) ?? 0 })
    }
    return rows
  }
  const byTypeMap = new Map<string, { total: number; reviews: ReviewLog[] }>()
  for (const card of input.cards) {
    const bucket = byTypeMap.get(card.type) ?? { total: 0, reviews: [] }
    bucket.total += 1
    byTypeMap.set(card.type, bucket)
  }
  for (const log of flashLogs) {
    const card = cardById.get(log.cardId)
    if (!card || log.rating < 1 || log.rating > 4) continue
    const bucket = byTypeMap.get(card.type) ?? { total: 0, reviews: [] }
    bucket.reviews.push(log)
    byTypeMap.set(card.type, bucket)
  }
  const byType: TypeStat[] = [...byTypeMap.entries()]
    .map(([type, bucket]) => ({
      type,
      label: cardTypeLabel(type),
      total: bucket.total,
      reviews: bucket.reviews.length,
      again: bucket.reviews.filter((log) => log.rating === 1).length,
      accuracy: accuracyOf(bucket.reviews),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'zh'))
  const weak = byType
    .filter((item) => item.reviews >= 4 && item.accuracy !== null && item.accuracy < 0.8)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, 3)
    .map((item) => ({
      type: item.type,
      label: item.label,
      accuracy: item.accuracy ?? 0,
      reviews: item.reviews,
    }))
  const recent = [...input.logs]
    .filter((log) => log.rating >= 1 && log.rating <= 4)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, 30)
    .map((log) => ({
      id: log.id,
      cardId: log.cardId,
      front: cardById.get(log.cardId)?.frontText ?? '已删除的卡片',
      rating: log.rating,
      reviewedAt: log.reviewedAt,
      source: log.source,
      exerciseType: log.exerciseType,
      correct: log.correct,
    }))
  return {
    total: input.cards.length,
    mastered,
    learning,
    fresh,
    due,
    overdue,
    introducedToday: countIntroducedOn(input.logs, today),
    reviewedToday: input.logs.filter((log) => {
      if (log.rating < 1 || log.rating > 4) return false
      if (log.source === 'manual' || log.source === 'reset') return false
      return dayKey(new Date(log.reviewedAt)) === today
    }).length,
    accuracy: accuracyOf(flashLogs),
    accuracyWeek: accuracyOf(weekLogs),
    exerciseAccuracy,
    streak: currentStreak(days, input.now),
    longestStreak: longestStreak(days),
    last7: series(7),
    last14: series(14),
    weak,
    byType,
    recent,
  }
}

export function recallRecord(records: SrsRecord[], cardId: string): SrsRecord | undefined {
  return records.find((record) => record.cardId === cardId && record.skill === 'recall')
}

export { SRS_NEW }
