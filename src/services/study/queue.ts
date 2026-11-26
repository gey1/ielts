import { dayKey } from '../../domain/time.ts'
import type { ReviewLog, SrsRecord, StudyMode } from '../../domain/types.ts'
import { isScheduledDue, SRS_LEARNING, SRS_NEW, SRS_RELEARNING } from '../srs/engine.ts'

export interface QueueCard {
  id: string
  createdAt: string
  record: SrsRecord | null
}

export function countIntroducedOn(logs: ReviewLog[], day: string): number {
  const cards = new Set<string>()
  for (const log of logs) {
    if (log.skill !== 'recall') continue
    if (log.source !== 'flashcard' && log.source !== 'exercise') continue
    if (log.stateBefore !== SRS_NEW) continue
    if (log.rating < 1 || log.rating > 4) continue
    if (dayKey(new Date(log.reviewedAt)) !== day) continue
    cards.add(log.cardId)
  }
  return cards.size
}

export function buildStudyQueue(
  cards: QueueCard[],
  options: { mode: StudyMode; now: Date; dailyNewLimit: number; introducedToday: number },
): string[] {
  const dueLearning: QueueCard[] = []
  const dueReview: QueueCard[] = []
  const fresh: QueueCard[] = []
  for (const card of cards) {
    const record = card.record
    if (!record || record.state === SRS_NEW) {
      fresh.push(card)
      continue
    }
    if (!isScheduledDue(record, options.now)) continue
    if (record.state === SRS_LEARNING || record.state === SRS_RELEARNING) dueLearning.push(card)
    else dueReview.push(card)
  }
  const byDue = (a: QueueCard, b: QueueCard) => {
    const left = new Date(a.record?.due ?? 0).getTime()
    const right = new Date(b.record?.due ?? 0).getTime()
    return left - right || a.id.localeCompare(b.id)
  }
  dueLearning.sort(byDue)
  dueReview.sort(byDue)
  fresh.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const ids = [...dueLearning, ...dueReview].map((card) => card.id)
  if (options.mode === 'programme') {
    const slots = Math.max(0, options.dailyNewLimit - options.introducedToday)
    ids.push(...fresh.slice(0, slots).map((card) => card.id))
  }
  return ids
}
