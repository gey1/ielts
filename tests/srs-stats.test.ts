import { describe, expect, it } from 'vitest'
import { dayKey } from '../src/domain/time.ts'
import type { ReviewLog, SrsRecord } from '../src/domain/types.ts'
import { dayDetail } from '../src/services/stats/calendar.ts'
import { computeStats, currentStreak } from '../src/services/stats/stats.ts'
import { masteryOf, scheduleRating } from '../src/services/srs/engine.ts'
import { buildStudyQueue, countIntroducedOn } from '../src/services/study/queue.ts'
import { answersMatch, makeCloze } from '../src/services/exercises/grade.ts'
import { buildExercise, programmeExercises } from '../src/services/exercises/select.ts'

const now = new Date(2026, 10, 26, 9, 0, 0)

describe('srs engine', () => {
  it('orders ratings and does not treat one Easy as mastery', () => {
    const again = scheduleRating(null, 'c1', 'recall', 1, now)
    const good = scheduleRating(null, 'c1', 'recall', 3, now)
    const easy = scheduleRating(null, 'c1', 'recall', 4, now)
    expect(new Date(again.record.due).getTime()).toBeLessThan(new Date(good.record.due).getTime())
    expect(new Date(good.record.due).getTime()).toBeLessThan(new Date(easy.record.due).getTime())
    expect(masteryOf(easy.record)).toBe('learning')
    expect(again.record.skill).toBe('recall')
    expect(again.log.stateBefore).toBe(0)
  })
})

describe('study queue', () => {
  it('limits new cards and keeps them out of review-only mode', () => {
    const cards = [
      { id: 'due', createdAt: '2026-01-01', record: record('due', 2, new Date(2026, 10, 25)) },
      { id: 'later', createdAt: '2026-01-02', record: record('later', 2, new Date(2026, 10, 28)) },
      { id: 'new-a', createdAt: '2026-02-01', record: null },
      { id: 'new-b', createdAt: '2026-02-02', record: null },
    ]
    expect(buildStudyQueue(cards, { mode: 'review', now, dailyNewLimit: 10, introducedToday: 0 })).toEqual(['due'])
    expect(buildStudyQueue(cards, { mode: 'programme', now, dailyNewLimit: 1, introducedToday: 0 })).toEqual(['due', 'new-a'])
    expect(buildStudyQueue(cards, { mode: 'programme', now, dailyNewLimit: 1, introducedToday: 1 })).toEqual(['due'])
  })

  it('counts only the first recall introduction on that day', () => {
    const today = new Date(2026, 10, 26, 8, 0, 0)
    const earlier = new Date(2026, 10, 26, 12, 0, 0)
    const yesterday = new Date(2026, 10, 25, 8, 0, 0)
    const logs: ReviewLog[] = [
      log('a', today.toISOString(), 0),
      log('a', earlier.toISOString(), 1),
      log('b', yesterday.toISOString(), 0),
    ]
    expect(countIntroducedOn(logs, dayKey(today))).toBe(1)
  })
})

describe('stats and calendar', () => {
  it('keeps a streak alive through today and explains overdue work on today', () => {
    const today = dayKey(now)
    const yesterday = dayKey(new Date(2026, 10, 25))
    expect(currentStreak(new Set([today, yesterday]), now)).toBe(2)
    expect(currentStreak(new Set([yesterday]), now)).toBe(1)
    expect(currentStreak(new Set([dayKey(new Date(2026, 10, 24))]), now)).toBe(0)

    const detail = dayDetail({
      day: now,
      now,
      cards: [
        { id: 'late', type: 'vocabulary', frontText: 'Late', createdAt: '2026-01-01' },
        { id: 'fresh', type: 'vocabulary', frontText: 'Fresh', createdAt: '2026-01-02' },
      ],
      records: [record('late', 2, new Date(2026, 10, 20))],
      logs: [],
      remainingNew: 1,
    })
    expect(detail.scheduled.map((item) => item.kind)).toEqual(['overdue'])
    expect(detail.introductions.map((item) => item.cardId)).toEqual(['fresh'])

    const future = dayDetail({
      day: new Date(2026, 10, 28),
      now,
      cards: [{ id: 'soon', type: 'vocabulary', frontText: 'Soon', createdAt: '2026-01-01' }],
      records: [record('soon', 2, new Date(2026, 10, 28, 8))],
      logs: [],
      remainingNew: 5,
    })
    expect(future.scheduled[0]?.kind).toBe('upcoming')
    expect(future.introductions).toEqual([])

    const stats = computeStats({
      cards: [{ id: 'late', type: 'vocabulary', frontText: 'Late', createdAt: '2026-01-01' }],
      records: [record('late', 2, new Date(2026, 10, 20))],
      logs: [],
      now,
    })
    expect(stats.due).toBe(1)
    expect(stats.overdue).toBe(1)
    expect(stats.accuracy).toBeNull()
  })
})

describe('exercises', () => {
  it('blanks whole words and accepts small typos', () => {
    expect(makeCloze('Cultural heritage matters.', 'age')).toBeNull()
    expect(makeCloze('Air quality has deteriorated since May.', 'Deteriorate')).toEqual({
      prompt: 'Air quality has ______ since May.',
      answer: 'deteriorated',
    })
    expect(answersMatch('Deteriorate', 'deterirate')).toBe(true)
    expect(answersMatch('Deteriorate', 'improve')).toBe(false)
  })

  it('does not schedule recognition inside the learning programme', () => {
    const card = {
      id: 'vocab-deteriorate',
      type: 'vocabulary',
      frontText: 'Deteriorate',
      backText: '恶化',
      blocks: [
        { type: 'definition', content: 'To become progressively worse.' },
        { type: 'example', content: 'Air quality has deteriorated.' },
      ],
    }
    const other = { ...card, id: 'other', frontText: 'Mitigate', backText: '减轻' }
    const recognition = buildExercise('recognition', card, [card, other], 3)
    expect(recognition?.skill).toBe('recognition')
    expect(recognition?.choices?.some((choice) => choice.label === 'Deteriorate')).toBe(true)
    const programme = programmeExercises({
      sessionIds: [card.id],
      cards: [card, other],
      states: new Map([[card.id, 1]]),
      limit: 2,
      seed: 4,
    })
    expect(programme.map((item) => item.type)).not.toContain('recognition')
    expect(programme[0]?.type).toBe('cloze')
    expect(programme[0]?.skill).toBe('application')
  })
})

function record(cardId: string, state: number, due: Date): SrsRecord {
  return {
    id: `${cardId}:recall`,
    cardId,
    skill: 'recall',
    due: due.toISOString(),
    stability: state === 2 ? 5 : 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 2,
    lapses: 0,
    state,
  }
}

function log(cardId: string, reviewedAt: string, stateBefore: number): ReviewLog {
  return {
    id: `rev-${cardId}-${reviewedAt}`,
    cardId,
    skill: 'recall',
    rating: 3,
    reviewedAt,
    stateBefore,
    stateAfter: 1,
    stabilityBefore: 0,
    stabilityAfter: 1,
    scheduledDays: 0,
    elapsedDays: 0,
    dueAfter: reviewedAt,
    source: 'flashcard',
  }
}
