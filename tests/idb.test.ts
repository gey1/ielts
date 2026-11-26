import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deriveCardId } from '../src/domain/ids.ts'
import { buildBackup, restoreBackup } from '../src/services/backup/backup.ts'
import { db, resetDatabaseForTests } from '../src/services/db/db.ts'
import { commitImport, previewImport, rollbackImport, RollbackRejected } from '../src/services/import/commit.ts'
import { saveCard } from '../src/services/library/library.ts'
import { applyReview } from '../src/services/srs/repository.ts'

const baseline = {
  schema_version: 1,
  cards: [
    {
      type: 'vocabulary',
      front: { text: 'Deteriorate' },
      back: { text: '恶化；变坏' },
      notes: [
        { type: 'definition', content: 'To become progressively worse.' },
        { type: 'example', content: 'Air quality has deteriorated.' },
      ],
      collections: ['Environment'],
      tags: ['writing'],
    },
  ],
}

beforeEach(async () => {
  await resetDatabaseForTests()
})

describe('indexeddb import, srs and backup', () => {
  it('updates content without touching scheduling, and rolls the batch back', async () => {
    const first = await commitImport(baseline, 'pack.json')
    const id = deriveCardId('vocabulary', 'Deteriorate')
    expect(first.summary.created).toBe(1)
    expect(await db.srsRecords.count()).toBe(0)
    const card = await db.cards.get(id)
    expect(card?.backText).toBe('恶化；变坏')
    expect(await db.collections.get('topic-environment')).toBeTruthy()

    const reviewedAt = new Date('2026-11-01T00:00:00Z')
    await applyReview({ cardId: id, skill: 'recall', grade: 3, source: 'flashcard', now: reviewedAt })
    const before = await db.srsRecords.get(`${id}:recall`)
    expect(before?.reps).toBe(1)

    const updated = {
      schema_version: 1,
      cards: [{
        id,
        type: 'vocabulary',
        front: { text: 'Deteriorate' },
        back: { text: '恶化' },
        notes: [{ type: 'definition', content: 'To get worse over time.' }],
      }],
    }
    const second = await commitImport(updated, 'update.json')
    expect(second.summary.updated).toBe(1)
    expect((await db.cards.get(id))?.backText).toBe('恶化')
    expect((await db.srsRecords.get(`${id}:recall`))?.reps).toBe(1)
    expect((await db.srsRecords.get(`${id}:recall`))?.due).toBe(before?.due)

    await expect(rollbackImport(first.id)).rejects.toBeInstanceOf(RollbackRejected)
    await rollbackImport(second.id)
    expect((await db.cards.get(id))?.backText).toBe('恶化；变坏')
    expect((await db.blocks.where('cardId').equals(id).count())).toBe(2)
    expect((await db.srsRecords.get(`${id}:recall`))?.reps).toBe(1)

    await rollbackImport(first.id)
    expect(await db.cards.get(id)).toBeUndefined()
    expect(await db.srsRecords.count()).toBe(0)
    expect(await db.reviewLogs.where('cardId').equals(id).count()).toBe(0)
  })

  it('does not write when preview fails, and restores a backup exactly', async () => {
    await saveCard({
      type: 'vocabulary',
      frontText: 'Mitigate',
      backText: '减轻',
      blocks: [],
      collectionIds: ['topic-environment'],
      tagNames: ['speaking'],
    })
    const saved = await db.cards.toArray()
    expect(saved).toHaveLength(1)
    const cardId = saved[0]!.id
    await applyReview({ cardId, skill: 'recognition', grade: 4, source: 'exercise', exerciseType: 'recognition', correct: true })
    const recallBefore = await db.srsRecords.get(`${cardId}:recall`)
    expect(recallBefore).toBeUndefined()
    expect(await db.srsRecords.get(`${cardId}:recognition`)).toBeTruthy()

    const rejected = await previewImport({ schema_version: 1, cards: [] , extra: true })
    expect(rejected.ok).toBe(false)
    expect(await db.cards.count()).toBe(1)

    const backup = await buildBackup()
    await db.cards.clear()
    expect(await db.cards.count()).toBe(0)
    await restoreBackup(backup)
    expect((await db.cards.toArray()).map((card) => card.frontText)).toEqual(['Mitigate'])
    expect(await db.srsRecords.get(`${cardId}:recognition`)).toBeTruthy()
    expect(await db.srsRecords.get(`${cardId}:recall`)).toBeUndefined()
    expect(await db.collections.get('topic-education')).toBeTruthy()
  })
})
