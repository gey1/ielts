import type {
  Card,
  CardCollection,
  CardTag,
  Collection,
  ContentBlock,
  ReviewLog,
  Settings,
  SrsRecord,
  Tag,
} from '../../domain/types.ts'
import { DEFAULT_DAILY_EXERCISES, DEFAULT_DAILY_NEW } from '../../domain/constants.ts'
import { db } from '../db/db.ts'

export interface Snapshot {
  cards: Card[]
  blocks: ContentBlock[]
  collections: Collection[]
  tags: Tag[]
  cardCollections: CardCollection[]
  cardTags: CardTag[]
  records: SrsRecord[]
  logs: ReviewLog[]
  settings: Settings
}

export function normalizeSettings(row: Settings | undefined): Settings {
  return {
    id: 'app',
    dailyNewLimit: clamp(row?.dailyNewLimit ?? DEFAULT_DAILY_NEW, 0, 200),
    dailyExerciseLimit: clamp(row?.dailyExerciseLimit ?? DEFAULT_DAILY_EXERCISES, 0, 50),
    studyMode: row?.studyMode === 'review' ? 'review' : 'programme',
    dataNoticeAck: row?.dataNoticeAck ?? false,
    persistRequested: row?.persistRequested ?? false,
    lastBackupAt: row?.lastBackupAt,
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [cards, blocks, collections, tags, cardCollections, cardTags, records, logs, settings] = await Promise.all([
    db.cards.toArray(),
    db.blocks.toArray(),
    db.collections.toArray(),
    db.tags.toArray(),
    db.cardCollections.toArray(),
    db.cardTags.toArray(),
    db.srsRecords.toArray(),
    db.reviewLogs.toArray(),
    db.settings.get('app'),
  ])
  return {
    cards,
    blocks,
    collections: collections.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'zh')),
    tags,
    cardCollections,
    cardTags,
    records,
    logs,
    settings: normalizeSettings(settings),
  }
}

export interface IndexedLibrary {
  blocksByCard: Map<string, ContentBlock[]>
  collectionIdsByCard: Map<string, string[]>
  tagIdsByCard: Map<string, string[]>
  recallByCard: Map<string, SrsRecord>
  collectionById: Map<string, Collection>
  tagById: Map<string, Tag>
}

export function indexSnapshot(snapshot: Snapshot): IndexedLibrary {
  const blocksByCard = new Map<string, ContentBlock[]>()
  for (const block of snapshot.blocks) {
    const list = blocksByCard.get(block.cardId) ?? []
    list.push(block)
    blocksByCard.set(block.cardId, list)
  }
  for (const list of blocksByCard.values()) list.sort((a, b) => a.position - b.position)
  const collectionIdsByCard = new Map<string, string[]>()
  for (const link of snapshot.cardCollections) {
    const list = collectionIdsByCard.get(link.cardId) ?? []
    list.push(link.collectionId)
    collectionIdsByCard.set(link.cardId, list)
  }
  const tagIdsByCard = new Map<string, string[]>()
  for (const link of snapshot.cardTags) {
    const list = tagIdsByCard.get(link.cardId) ?? []
    list.push(link.tagId)
    tagIdsByCard.set(link.cardId, list)
  }
  const recallByCard = new Map<string, SrsRecord>()
  for (const record of snapshot.records) {
    if (record.skill === 'recall') recallByCard.set(record.cardId, record)
  }
  return {
    blocksByCard,
    collectionIdsByCard,
    tagIdsByCard,
    recallByCard,
    collectionById: new Map(snapshot.collections.map((item) => [item.id, item])),
    tagById: new Map(snapshot.tags.map((item) => [item.id, item])),
  }
}
