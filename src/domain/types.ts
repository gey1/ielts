export const CARD_TYPES = [
  'vocabulary',
  'collocation',
  'paraphrasing',
  'sentence_structure',
  'grammar_pattern',
  'register',
] as const

export type KnownCardType = (typeof CARD_TYPES)[number]

export const BLOCK_TYPES = [
  'definition',
  'translation',
  'example',
  'pronunciation',
  'synonyms',
  'antonyms',
  'collocations',
  'grammar',
  'usage_note',
  'common_mistakes',
] as const

export type KnownBlockType = (typeof BLOCK_TYPES)[number]

export const SKILLS = ['recognition', 'recall', 'application', 'fluency'] as const
export type Skill = (typeof SKILLS)[number]

export const REVIEW_SOURCES = ['flashcard', 'exercise', 'manual', 'reset'] as const
export type ReviewSource = (typeof REVIEW_SOURCES)[number]

export type ReviewGrade = 1 | 2 | 3 | 4
export type StudyMode = 'programme' | 'review'
export type CardOrigin = 'user' | 'import'
export type CollectionKind = 'topic' | 'custom'

export interface Card {
  id: string
  type: string
  frontText: string
  backText: string
  createdAt: string
  updatedAt: string
  origin: CardOrigin
}

export interface ContentBlock {
  id: string
  cardId: string
  type: string
  content: string
  position: number
}

export interface Collection {
  id: string
  name: string
  nameEn: string
  description: string
  kind: CollectionKind
  preset: boolean
  position: number
  createdAt: string
}

export interface Tag {
  id: string
  name: string
  createdAt: string
}

export interface CardCollection {
  id: string
  cardId: string
  collectionId: string
}

export interface CardTag {
  id: string
  cardId: string
  tagId: string
}

export interface SrsRecord {
  id: string
  cardId: string
  skill: Skill
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: number
  lastReview?: string
}

export interface ReviewLog {
  id: string
  cardId: string
  skill: Skill
  rating: number
  reviewedAt: string
  stateBefore: number
  stateAfter: number
  stabilityBefore: number
  stabilityAfter: number
  scheduledDays: number
  elapsedDays: number
  dueAfter: string
  source: ReviewSource
  exerciseType?: string
  correct?: boolean
}

export interface ImportIssue {
  path: string
  code: string
  message: string
  level: 'error' | 'warning'
}

export interface CardSnapshot {
  card: Card
  blocks: ContentBlock[]
  collectionIds: string[]
  tagIds: string[]
}

export interface ImportSummary {
  created: number
  updated: number
  collectionsCreated: number
  tagsCreated: number
  warnings: number
}

export interface ImportBatch {
  id: string
  createdAt: string
  filename: string | null
  schemaVersion: number
  status: 'applied' | 'rolled_back'
  summary: ImportSummary
  createdCardIds: string[]
  createdCollectionIds: string[]
  createdTagIds: string[]
  previous: CardSnapshot[]
  warnings: ImportIssue[]
  rolledBackAt?: string
}

export interface Settings {
  id: 'app'
  dailyNewLimit: number
  dailyExerciseLimit: number
  studyMode: StudyMode
  dataNoticeAck: boolean
  persistRequested: boolean
  lastBackupAt?: string
}

export interface BackupFile {
  backup_version: 1
  exported_at: string
  app: 'cijing'
  cards: Card[]
  blocks: ContentBlock[]
  collections: Collection[]
  tags: Tag[]
  cardCollections: CardCollection[]
  cardTags: CardTag[]
  srsRecords: SrsRecord[]
  reviewLogs: ReviewLog[]
  importBatches: ImportBatch[]
  settings: Settings
}
