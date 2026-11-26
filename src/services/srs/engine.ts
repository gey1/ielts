import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs'
import { MASTERED_STABILITY_DAYS } from '../../domain/constants.ts'
import { srsId } from '../../domain/ids.ts'
import { formatInterval } from '../../domain/time.ts'
import type { ReviewGrade, ReviewLog, Skill, SrsRecord } from '../../domain/types.ts'

const scheduler = fsrs({ enable_fuzz: false, enable_short_term: true })

export const SRS_NEW = State.New
export const SRS_LEARNING = State.Learning
export const SRS_REVIEW = State.Review
export const SRS_RELEARNING = State.Relearning

export type Mastery = 'new' | 'learning' | 'mastered'

export function toFsrsCard(record: SrsRecord | null, now: Date): FsrsCard {
  if (!record) return createEmptyCard(now)
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsedDays,
    scheduled_days: record.scheduledDays,
    learning_steps: record.learningSteps,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state as State,
    last_review: record.lastReview ? new Date(record.lastReview) : undefined,
  }
}

export function fromFsrsCard(cardId: string, skill: Skill, card: FsrsCard): SrsRecord {
  const record: SrsRecord = {
    id: srsId(cardId, skill),
    cardId,
    skill,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  }
  if (card.last_review) record.lastReview = card.last_review.toISOString()
  return record
}

export function freshRecord(cardId: string, skill: Skill, now: Date): SrsRecord {
  return fromFsrsCard(cardId, skill, createEmptyCard(now))
}

export function masteryOf(record: SrsRecord | null | undefined): Mastery {
  if (!record || record.state === State.New) return 'new'
  if (record.state === State.Review && record.stability >= MASTERED_STABILITY_DAYS) return 'mastered'
  return 'learning'
}

export function isScheduledDue(record: SrsRecord, now: Date): boolean {
  return record.state !== State.New && new Date(record.due).getTime() <= now.getTime()
}

export interface ScheduledReview {
  record: SrsRecord
  log: Omit<ReviewLog, 'id' | 'source' | 'exerciseType' | 'correct'>
}

export function scheduleRating(
  record: SrsRecord | null,
  cardId: string,
  skill: Skill,
  grade: ReviewGrade,
  now: Date,
): ScheduledReview {
  const current = toFsrsCard(record, now)
  const next = scheduler.next(current, now, grade as Grade)
  const stored = fromFsrsCard(cardId, skill, next.card)
  return {
    record: stored,
    log: {
      cardId,
      skill,
      rating: grade,
      reviewedAt: now.toISOString(),
      stateBefore: current.state,
      stateAfter: next.card.state,
      stabilityBefore: current.stability,
      stabilityAfter: next.card.stability,
      scheduledDays: next.card.scheduled_days,
      elapsedDays: next.log.elapsed_days,
      dueAfter: next.card.due.toISOString(),
    },
  }
}

export interface IntervalChoice {
  grade: ReviewGrade
  due: string
  label: string
}

export function previewIntervals(record: SrsRecord | null, now: Date): IntervalChoice[] {
  const current = toFsrsCard(record, now)
  const preview = scheduler.repeat(current, now)
  const grades: ReviewGrade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]
  return grades.map((grade) => {
    const item = preview[grade]
    return {
      grade,
      due: item.card.due.toISOString(),
      label: formatInterval(now, item.card.due),
    }
  })
}

export function withDue(record: SrsRecord, due: Date): SrsRecord {
  return { ...record, due: due.toISOString() }
}
