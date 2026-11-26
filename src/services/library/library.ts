import { findPreset, PRESETS } from '../../domain/constants.ts'
import { createId, deriveCollectionId, deriveTagId, linkId } from '../../domain/ids.ts'
import type { Card, ContentBlock, Settings, StudyMode } from '../../domain/types.ts'
import { db } from '../db/db.ts'
export interface CardDraft {
  type: string
  frontText: string
  backText: string
  blocks: { type: string; content: string }[]
  collectionIds: string[]
  tagNames: string[]
  newCollectionName?: string
}

function cleanBlocks(blocks: CardDraft['blocks']): { type: string; content: string }[] {
  return blocks
    .map((block) => ({ type: block.type.trim(), content: block.content.trim() }))
    .filter((block) => block.type && block.content)
}

export async function saveCard(draft: CardDraft, existingId?: string): Promise<string> {
  const frontText = draft.frontText.trim()
  const type = draft.type.trim()
  if (!frontText) throw new Error('请先写卡片正面。')
  if (!type) throw new Error('请选择卡片类型。')
  const id = existingId ?? createId('card')
  const now = new Date().toISOString()
  await db.transaction('rw', [db.cards, db.blocks, db.collections, db.tags, db.cardCollections, db.cardTags], async () => {
    const current = await db.cards.get(id)
    const collectionIds = [...draft.collectionIds]
    const extra = draft.newCollectionName?.trim()
    if (extra) {
      const collectionId = await ensureCollectionName(extra, now)
      if (!collectionIds.includes(collectionId)) collectionIds.push(collectionId)
    }
    const tagIds: string[] = []
    for (const name of draft.tagNames) {
      const trimmed = name.trim()
      if (!trimmed) continue
      const tagId = await ensureTagName(trimmed, now)
      if (!tagIds.includes(tagId)) tagIds.push(tagId)
    }
    const card: Card = {
      id,
      type,
      frontText,
      backText: draft.backText.trim(),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      origin: current?.origin ?? 'user',
    }
    await db.cards.put(card)
    await db.blocks.where('cardId').equals(id).delete()
    const blocks: ContentBlock[] = cleanBlocks(draft.blocks).map((block, index) => ({
      id: `${id}:b${index}`,
      cardId: id,
      type: block.type,
      content: block.content,
      position: index,
    }))
    if (blocks.length) await db.blocks.bulkAdd(blocks)
    await db.cardCollections.where('cardId').equals(id).delete()
    if (collectionIds.length) {
      await db.cardCollections.bulkAdd(collectionIds.map((collectionId) => ({
        id: linkId(id, collectionId),
        cardId: id,
        collectionId,
      })))
    }
    await db.cardTags.where('cardId').equals(id).delete()
    if (tagIds.length) {
      await db.cardTags.bulkAdd(tagIds.map((tagId) => ({
        id: linkId(id, tagId),
        cardId: id,
        tagId,
      })))
    }
  })
  return id
}

async function ensureCollectionName(name: string, now: string): Promise<string> {
  const preset = findPreset(name)
  if (preset) {
    const row = await db.collections.get(preset.id)
    if (!row) {
      await db.collections.add({
        id: preset.id,
        name: preset.name,
        nameEn: preset.nameEn,
        description: preset.description,
        kind: 'topic',
        preset: true,
        position: preset.position,
        createdAt: now,
      })
    }
    return preset.id
  }
  const all = await db.collections.toArray()
  const found = all.find((item) => item.name.trim().toLowerCase() === name.toLowerCase())
  if (found) return found.id
  const id = deriveCollectionId(name)
  await db.collections.add({
    id,
    name,
    nameEn: '',
    description: '',
    kind: 'custom',
    preset: false,
    position: 1000,
    createdAt: now,
  })
  return id
}

async function ensureTagName(name: string, now: string): Promise<string> {
  const all = await db.tags.toArray()
  const found = all.find((item) => item.name.trim().toLowerCase() === name.toLowerCase())
  if (found) return found.id
  const id = deriveTagId(name)
  const existing = await db.tags.get(id)
  if (!existing) await db.tags.add({ id, name, createdAt: now })
  return id
}

export async function deleteCard(cardId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.cards, db.blocks, db.cardCollections, db.cardTags, db.srsRecords, db.reviewLogs],
    async () => {
      await db.cards.delete(cardId)
      await db.blocks.where('cardId').equals(cardId).delete()
      await db.cardCollections.where('cardId').equals(cardId).delete()
      await db.cardTags.where('cardId').equals(cardId).delete()
      await db.srsRecords.where('cardId').equals(cardId).delete()
      await db.reviewLogs.where('cardId').equals(cardId).delete()
    },
  )
}

export async function createCollection(name: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请填写词集名称。')
  return db.transaction('rw', db.collections, async () => ensureCollectionName(trimmed, new Date().toISOString()))
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空。')
  const row = await db.collections.get(id)
  if (!row) throw new Error('找不到这个词集。')
  if (row.preset) throw new Error('预置专题的名称固定，便于导入对照。可以另建一个自己的词集。')
  await db.collections.put({ ...row, name: trimmed })
}

export async function deleteCollection(id: string): Promise<void> {
  await db.transaction('rw', [db.collections, db.cardCollections], async () => {
    const row = await db.collections.get(id)
    if (!row) return
    if (row.preset) throw new Error('预置专题不能删除。')
    await db.cardCollections.where('collectionId').equals(id).delete()
    await db.collections.delete(id)
  })
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await db.settings.get('app')
  if (!current) throw new Error('设置还没有准备好。')
  const next: Settings = { ...current, ...patch, id: 'app' }
  if (next.dailyNewLimit < 0) next.dailyNewLimit = 0
  if (next.dailyNewLimit > 200) next.dailyNewLimit = 200
  if (next.dailyExerciseLimit < 0) next.dailyExerciseLimit = 0
  if (next.dailyExerciseLimit > 50) next.dailyExerciseLimit = 50
  await db.settings.put(next)
}

export async function setStudyMode(mode: StudyMode): Promise<void> {
  await updateSettings({ studyMode: mode })
}

export function presetIds(): string[] {
  return PRESETS.map((preset) => preset.id)
}
