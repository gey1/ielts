import { createId, linkId } from '../../domain/ids.ts'
import type { Card, CardSnapshot, ContentBlock, ImportBatch, ImportIssue } from '../../domain/types.ts'
import { db } from '../db/db.ts'
import { canCommit, planImport, type ImportPlan, type PlanContext } from './plan.ts'
import { parseImport } from './schema.ts'

export class ImportRejected extends Error {
  issues: ImportIssue[]

  constructor(issues: ImportIssue[]) {
    super(issues.map((item) => item.message).join('\n') || '无法导入')
    this.name = 'ImportRejected'
    this.issues = issues
  }
}

export class RollbackRejected extends Error {
  code: 'missing' | 'rolled_back' | 'not_latest'

  constructor(code: RollbackRejected['code'], message: string) {
    super(message)
    this.name = 'RollbackRejected'
    this.code = code
  }
}

async function readContext(): Promise<PlanContext> {
  const [cards, collections, tags] = await Promise.all([
    db.cards.toArray(),
    db.collections.toArray(),
    db.tags.toArray(),
  ])
  return {
    cards: cards.map((card) => ({ id: card.id, type: card.type, frontText: card.frontText })),
    collections: collections.map((item) => ({ id: item.id, name: item.name, nameEn: item.nameEn })),
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
  }
}

export interface PreviewResult {
  ok: boolean
  errors: ImportIssue[]
  warnings: ImportIssue[]
  plan: ImportPlan | null
}

export async function previewImport(raw: unknown): Promise<PreviewResult> {
  const parsed = parseImport(raw)
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: [], plan: null }
  const plan = planImport(parsed.file, await readContext())
  return { ok: canCommit(plan), errors: plan.errors, warnings: plan.warnings, plan }
}

export async function commitImport(raw: unknown, filename: string | null): Promise<ImportBatch> {
  const parsed = parseImport(raw)
  if (!parsed.ok) throw new ImportRejected(parsed.errors)
  const now = new Date().toISOString()
  return db.transaction(
    'rw',
    [db.cards, db.blocks, db.collections, db.tags, db.cardCollections, db.cardTags, db.importBatches],
    async () => {
      const plan = planImport(parsed.file, await readContext())
      if (!canCommit(plan)) throw new ImportRejected(plan.errors.length ? plan.errors : [
        { path: '', code: 'empty', message: '没有可以导入的内容。', level: 'error' },
      ])
      const createdCardIds: string[] = []
      const previous: CardSnapshot[] = []
      for (const item of plan.collectionsToCreate) {
        const exists = await db.collections.get(item.id)
        if (!exists) {
          await db.collections.add({
            id: item.id,
            name: item.name,
            nameEn: item.nameEn,
            description: item.description,
            kind: item.kind,
            preset: item.preset,
            position: item.position,
            createdAt: now,
          })
        }
      }
      const createdCollectionIds: string[] = []
      for (const item of plan.collectionsToCreate) {
        const row = await db.collections.get(item.id)
        if (row && row.createdAt === now) createdCollectionIds.push(item.id)
      }
      for (const tag of plan.tagsToCreate) {
        const exists = await db.tags.get(tag.id)
        if (!exists) await db.tags.add({ id: tag.id, name: tag.name, createdAt: now })
      }
      const createdTagIds: string[] = []
      for (const tag of plan.tagsToCreate) {
        const row = await db.tags.get(tag.id)
        if (row && row.createdAt === now) createdTagIds.push(tag.id)
      }

      for (const planned of plan.cards) {
        if (planned.action === 'update') {
          const current = await db.cards.get(planned.id)
          if (!current) {
            await writeCard(planned, now, now)
            createdCardIds.push(planned.id)
            continue
          }
          const blocks = await db.blocks.where('cardId').equals(planned.id).toArray()
          const collections = await db.cardCollections.where('cardId').equals(planned.id).toArray()
          const tags = await db.cardTags.where('cardId').equals(planned.id).toArray()
          previous.push({
            card: current,
            blocks,
            collectionIds: collections.map((link) => link.collectionId),
            tagIds: tags.map((link) => link.tagId),
          })
          await db.cards.put({
            ...current,
            type: planned.type,
            frontText: planned.frontText,
            backText: planned.backText,
            updatedAt: now,
            origin: 'import',
          })
          await replaceChildren(planned.id, planned.blocks, planned.collectionIds, planned.tagIds)
        } else {
          await writeCard(planned, now, now)
          createdCardIds.push(planned.id)
        }
      }

      const batch: ImportBatch = {
        id: createId('batch'),
        createdAt: now,
        filename,
        schemaVersion: 1,
        status: 'applied',
        summary: {
          created: createdCardIds.length,
          updated: previous.length,
          collectionsCreated: createdCollectionIds.length,
          tagsCreated: createdTagIds.length,
          warnings: plan.warnings.length,
        },
        createdCardIds,
        createdCollectionIds,
        createdTagIds,
        previous,
        warnings: plan.warnings,
      }
      await db.importBatches.add(batch)
      return batch
    },
  )
}

async function writeCard(
  planned: ImportPlan['cards'][number],
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  const card: Card = {
    id: planned.id,
    type: planned.type,
    frontText: planned.frontText,
    backText: planned.backText,
    createdAt,
    updatedAt,
    origin: 'import',
  }
  await db.cards.put(card)
  await replaceChildren(planned.id, planned.blocks, planned.collectionIds, planned.tagIds)
}

async function replaceChildren(
  cardId: string,
  blocks: { type: string; content: string }[],
  collectionIds: string[],
  tagIds: string[],
): Promise<void> {
  await db.blocks.where('cardId').equals(cardId).delete()
  await db.cardCollections.where('cardId').equals(cardId).delete()
  await db.cardTags.where('cardId').equals(cardId).delete()
  if (blocks.length > 0) {
    const rows: ContentBlock[] = blocks.map((block, index) => ({
      id: `${cardId}:b${index}`,
      cardId,
      type: block.type,
      content: block.content,
      position: index,
    }))
    await db.blocks.bulkAdd(rows)
  }
  if (collectionIds.length > 0) {
    await db.cardCollections.bulkAdd(collectionIds.map((collectionId) => ({
      id: linkId(cardId, collectionId),
      cardId,
      collectionId,
    })))
  }
  if (tagIds.length > 0) {
    await db.cardTags.bulkAdd(tagIds.map((tagId) => ({
      id: linkId(cardId, tagId),
      cardId,
      tagId,
    })))
  }
}

export async function latestAppliedBatch(): Promise<ImportBatch | undefined> {
  const batches = await db.importBatches.orderBy('createdAt').reverse().toArray()
  return batches.find((batch) => batch.status === 'applied')
}

export async function rollbackImport(batchId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.cards,
      db.blocks,
      db.collections,
      db.tags,
      db.cardCollections,
      db.cardTags,
      db.srsRecords,
      db.reviewLogs,
      db.importBatches,
    ],
    async () => {
      const batch = await db.importBatches.get(batchId)
      if (!batch) throw new RollbackRejected('missing', '找不到这批导入。')
      if (batch.status !== 'applied') throw new RollbackRejected('rolled_back', '这批导入已经撤销过了。')
      const latest = await latestAppliedBatch()
      if (!latest || latest.id !== batch.id) {
        throw new RollbackRejected('not_latest', '请先撤销更新的一批导入，再撤销这一批。')
      }
      for (const cardId of batch.createdCardIds) {
        await db.cards.delete(cardId)
        await db.blocks.where('cardId').equals(cardId).delete()
        await db.cardCollections.where('cardId').equals(cardId).delete()
        await db.cardTags.where('cardId').equals(cardId).delete()
        await db.srsRecords.where('cardId').equals(cardId).delete()
        await db.reviewLogs.where('cardId').equals(cardId).delete()
      }
      for (const snap of batch.previous) {
        await db.cards.put(snap.card)
        await replaceChildren(snap.card.id, snap.blocks, snap.collectionIds, snap.tagIds)
      }
      for (const collectionId of batch.createdCollectionIds) {
        const links = await db.cardCollections.where('collectionId').equals(collectionId).count()
        const row = await db.collections.get(collectionId)
        if (links === 0 && row && !row.preset) await db.collections.delete(collectionId)
      }
      for (const tagId of batch.createdTagIds) {
        const links = await db.cardTags.where('tagId').equals(tagId).count()
        if (links === 0) await db.tags.delete(tagId)
      }
      await db.importBatches.put({ ...batch, status: 'rolled_back', rolledBackAt: new Date().toISOString() })
    },
  )
}
