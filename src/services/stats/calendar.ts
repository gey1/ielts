import { addDays, dayKey, startOfLocalDay, weekdayIndexMonday } from '../../domain/time.ts'
import type { ReviewLog, SrsRecord } from '../../domain/types.ts'
import { isScheduledDue, SRS_NEW } from '../srs/engine.ts'

export interface CalendarCard {
  id: string
  type: string
  frontText: string
  createdAt: string
}

export interface ScheduledItem {
  cardId: string
  front: string
  type: string
  kind: 'overdue' | 'due' | 'upcoming' | 'missed'
}

export interface CompletedItem {
  logId: string
  cardId: string
  front: string
  rating: number
  source: string
  exerciseType?: string
  at: string
}

export interface DayDetail {
  key: string
  scheduled: ScheduledItem[]
  completed: CompletedItem[]
  introductions: { cardId: string; front: string; type: string }[]
}

export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -weekdayIndexMonday(first))
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function dayDetail(input: {
  day: Date
  now: Date
  cards: CalendarCard[]
  records: SrsRecord[]
  logs: ReviewLog[]
  remainingNew: number
}): DayDetail {
  const key = dayKey(input.day)
  const todayKey = dayKey(input.now)
  const startToday = startOfLocalDay(input.now)
  const cardById = new Map(input.cards.map((card) => [card.id, card]))
  const recall = input.records.filter((record) => record.skill === 'recall')
  const scheduled: ScheduledItem[] = []
  if (key === todayKey) {
    for (const record of recall) {
      if (!isScheduledDue(record, input.now)) continue
      const card = cardById.get(record.cardId)
      if (!card) continue
      const overdue = new Date(record.due).getTime() < startToday.getTime()
      scheduled.push({
        cardId: card.id,
        front: card.frontText,
        type: card.type,
        kind: overdue ? 'overdue' : 'due',
      })
    }
  } else if (input.day.getTime() < startToday.getTime()) {
    for (const record of recall) {
      if (record.state === SRS_NEW) continue
      if (dayKey(new Date(record.due)) !== key) continue
      if (new Date(record.due).getTime() >= startToday.getTime()) continue
      const card = cardById.get(record.cardId)
      if (!card) continue
      scheduled.push({ cardId: card.id, front: card.frontText, type: card.type, kind: 'missed' })
    }
  } else {
    for (const record of recall) {
      if (record.state === SRS_NEW) continue
      if (dayKey(new Date(record.due)) !== key) continue
      const card = cardById.get(record.cardId)
      if (!card) continue
      scheduled.push({ cardId: card.id, front: card.frontText, type: card.type, kind: 'upcoming' })
    }
  }
  scheduled.sort((a, b) => a.front.localeCompare(b.front, 'en'))
  const completed: CompletedItem[] = input.logs
    .filter((log) => log.rating >= 1 && log.rating <= 4 && dayKey(new Date(log.reviewedAt)) === key)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .map((log) => ({
      logId: log.id,
      cardId: log.cardId,
      front: cardById.get(log.cardId)?.frontText ?? '已删除的卡片',
      rating: log.rating,
      source: log.source,
      exerciseType: log.exerciseType,
      at: log.reviewedAt,
    }))
  const introductions = key === todayKey
    ? input.cards
        .filter((card) => {
          const record = recall.find((item) => item.cardId === card.id)
          return !record || record.state === SRS_NEW
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .slice(0, Math.max(0, input.remainingNew))
        .map((card) => ({ cardId: card.id, front: card.frontText, type: card.type }))
    : []
  return { key, scheduled, completed, introductions }
}
