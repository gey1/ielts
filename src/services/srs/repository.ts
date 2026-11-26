import { createId, srsId } from '../../domain/ids.ts'
import type { ReviewGrade, ReviewSource, Skill } from '../../domain/types.ts'
import { db } from '../db/db.ts'
import { freshRecord, scheduleRating, SRS_NEW, withDue } from './engine.ts'

export async function applyReview(input: {
  cardId: string
  skill: Skill
  grade: ReviewGrade
  source: Extract<ReviewSource, 'flashcard' | 'exercise'>
  exerciseType?: string
  correct?: boolean
  now?: Date
}): Promise<void> {
  const now = input.now ?? new Date()
  const id = srsId(input.cardId, input.skill)
  await db.transaction('rw', [db.srsRecords, db.reviewLogs], async () => {
    const current = (await db.srsRecords.get(id)) ?? null
    const scheduled = scheduleRating(current, input.cardId, input.skill, input.grade, now)
    await db.srsRecords.put(scheduled.record)
    await db.reviewLogs.add({
      ...scheduled.log,
      id: createId('rev'),
      source: input.source,
      exerciseType: input.exerciseType,
      correct: input.correct,
    })
  })
}

export async function rescheduleCard(cardId: string, due: Date): Promise<void> {
  const id = srsId(cardId, 'recall')
  await db.transaction('rw', [db.srsRecords, db.reviewLogs], async () => {
    const current = await db.srsRecords.get(id)
    if (!current || current.state === SRS_NEW) {
      throw new Error('新卡片还没有排程，先学习一次再调整日期。')
    }
    const next = withDue(current, due)
    await db.srsRecords.put(next)
    await db.reviewLogs.add({
      id: createId('rev'),
      cardId,
      skill: 'recall',
      rating: 0,
      reviewedAt: new Date().toISOString(),
      stateBefore: current.state,
      stateAfter: current.state,
      stabilityBefore: current.stability,
      stabilityAfter: current.stability,
      scheduledDays: current.scheduledDays,
      elapsedDays: 0,
      dueAfter: due.toISOString(),
      source: 'manual',
    })
  })
}

export async function resetCard(cardId: string): Promise<void> {
  const now = new Date()
  const id = srsId(cardId, 'recall')
  await db.transaction('rw', [db.srsRecords, db.reviewLogs], async () => {
    const current = await db.srsRecords.get(id)
    if (!current || current.state === SRS_NEW) return
    const fresh = freshRecord(cardId, 'recall', now)
    await db.srsRecords.put(fresh)
    await db.reviewLogs.add({
      id: createId('rev'),
      cardId,
      skill: 'recall',
      rating: 0,
      reviewedAt: now.toISOString(),
      stateBefore: current.state,
      stateAfter: fresh.state,
      stabilityBefore: current.stability,
      stabilityAfter: fresh.stability,
      scheduledDays: 0,
      elapsedDays: 0,
      dueAfter: fresh.due,
      source: 'reset',
    })
  })
}
