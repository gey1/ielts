import Dexie, { type Table } from 'dexie'
import { DB_NAME, DEFAULT_DAILY_EXERCISES, DEFAULT_DAILY_NEW, PRESETS } from '../../domain/constants.ts'
import type {
  Card,
  CardCollection,
  CardTag,
  Collection,
  ContentBlock,
  ImportBatch,
  ReviewLog,
  Settings,
  SrsRecord,
  Tag,
} from '../../domain/types.ts'

export class AppDatabase extends Dexie {
  cards!: Table<Card, string>
  blocks!: Table<ContentBlock, string>
  collections!: Table<Collection, string>
  tags!: Table<Tag, string>
  cardCollections!: Table<CardCollection, string>
  cardTags!: Table<CardTag, string>
  srsRecords!: Table<SrsRecord, string>
  reviewLogs!: Table<ReviewLog, string>
  importBatches!: Table<ImportBatch, string>
  settings!: Table<Settings, string>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({
      cards: 'id, type, updatedAt, createdAt',
      blocks: 'id, cardId, type',
      collections: 'id, kind, name, preset',
      tags: 'id, name',
      cardCollections: 'id, cardId, collectionId',
      cardTags: 'id, cardId, tagId',
      srsRecords: 'id, cardId, skill, due, state',
      reviewLogs: 'id, cardId, skill, reviewedAt, source',
      importBatches: 'id, createdAt, status',
      settings: 'id',
    })
  }
}

export const db = new AppDatabase()

let opening: Promise<void> | null = null

export async function ensureFoundation(): Promise<void> {
  const now = new Date(0).toISOString()
  await db.transaction('rw', [db.collections, db.settings], async () => {
    const existing = await db.settings.get('app')
    if (!existing) {
      await db.settings.add({
        id: 'app',
        dailyNewLimit: DEFAULT_DAILY_NEW,
        dailyExerciseLimit: DEFAULT_DAILY_EXERCISES,
        studyMode: 'programme',
        dataNoticeAck: false,
        persistRequested: false,
      })
    }
    for (const preset of PRESETS) {
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
    }
  })
}

async function openAndSeed(): Promise<void> {
  await db.open()
  await ensureFoundation()
}

export function ready(): Promise<void> {
  if (!opening) {
    opening = openAndSeed().catch((error: unknown) => {
      opening = null
      throw error
    })
  }
  return opening
}

export async function resetDatabaseForTests(): Promise<void> {
  opening = null
  try {
    await db.delete()
  } catch {
    // The database may not have been created yet.
  }
  await ready()
}
