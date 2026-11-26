import { findPreset, PRESETS } from '../../domain/constants.ts'
import {
  deriveCardId,
  deriveCollectionId,
  deriveTagId,
  frontKey,
  isStableId,
} from '../../domain/ids.ts'
import { CARD_TYPES } from '../../domain/types.ts'
import type { ImportIssue } from '../../domain/types.ts'
import type { ImportFile, ImportFileCard } from './schema.ts'

export interface PlanContext {
  cards: { id: string; type: string; frontText: string }[]
  collections: { id: string; name: string; nameEn?: string }[]
  tags: { id: string; name: string }[]
}

export interface PlannedBlock {
  type: string
  content: string
}

export interface PlannedCard {
  action: 'create' | 'update'
  id: string
  type: string
  frontText: string
  backText: string
  blocks: PlannedBlock[]
  collectionIds: string[]
  tagIds: string[]
  warnings: ImportIssue[]
}

export interface PlannedCollection {
  id: string
  name: string
  nameEn: string
  description: string
  kind: 'topic' | 'custom'
  preset: boolean
  position: number
}

export interface PlannedTag {
  id: string
  name: string
}

export interface ImportPlan {
  errors: ImportIssue[]
  warnings: ImportIssue[]
  cards: PlannedCard[]
  collectionsToCreate: PlannedCollection[]
  tagsToCreate: PlannedTag[]
}

function warn(path: string, code: string, message: string): ImportIssue {
  return { path, code, message, level: 'warning' }
}

function error(path: string, code: string, message: string): ImportIssue {
  return { path, code, message, level: 'error' }
}

function nameKey(value: string): string {
  return value.trim().toLowerCase()
}

export function canCommit(plan: ImportPlan): boolean {
  return plan.errors.length === 0 && (plan.cards.length > 0 || plan.collectionsToCreate.length > 0)
}

export function planImport(file: ImportFile, ctx: PlanContext): ImportPlan {
  const errors: ImportIssue[] = []
  const warnings: ImportIssue[] = []
  const collectionsToCreate: PlannedCollection[] = []
  const tagsToCreate: PlannedTag[] = []

  const collectionIds = new Set(ctx.collections.map((item) => item.id))
  const collectionsByName = new Map<string, string>()
  for (const item of ctx.collections) {
    collectionsByName.set(nameKey(item.name), item.id)
    if (item.nameEn) collectionsByName.set(nameKey(item.nameEn), item.id)
  }
  for (const preset of PRESETS) {
    collectionsByName.set(nameKey(preset.name), preset.id)
    collectionsByName.set(nameKey(preset.nameEn), preset.id)
    collectionsByName.set(preset.id.toLowerCase(), preset.id)
  }

  const tagsByName = new Map<string, string>()
  for (const tag of ctx.tags) tagsByName.set(nameKey(tag.name), tag.id)

  const knownCardIds = new Set(ctx.cards.map((card) => card.id))
  const knownFronts = new Map<string, string>()
  for (const card of ctx.cards) knownFronts.set(frontKey(card.type, card.frontText), card.id)

  function ensureCollection(id: string, draft: PlannedCollection | null): string {
    if (!collectionIds.has(id) && draft && !collectionsToCreate.some((item) => item.id === id)) {
      collectionsToCreate.push(draft)
      collectionIds.add(id)
    }
    return id
  }

  function resolveCollection(ref: string, path: string): string | null {
    const trimmed = ref.trim()
    if (!trimmed) {
      errors.push(error(path, 'empty_collection', '词集名称不能为空。'))
      return null
    }
    const preset = findPreset(trimmed)
    if (preset) {
      ensureCollection(preset.id, collectionIds.has(preset.id)
        ? null
        : {
            id: preset.id,
            name: preset.name,
            nameEn: preset.nameEn,
            description: preset.description,
            kind: 'topic',
            preset: true,
            position: preset.position,
          })
      return preset.id
    }
    const byName = collectionsByName.get(nameKey(trimmed))
    if (byName) return byName
    if (collectionIds.has(trimmed)) return trimmed
    if (!isStableId(trimmed) && trimmed.includes(' ')) {
      const id = deriveCollectionId(trimmed)
      collectionsByName.set(nameKey(trimmed), id)
      return ensureCollection(id, {
        id,
        name: trimmed,
        nameEn: '',
        description: '',
        kind: 'custom',
        preset: false,
        position: 1000,
      })
    }
    if (isStableId(trimmed) && (trimmed.startsWith('col-') || trimmed.startsWith('topic-'))) {
      return ensureCollection(trimmed, {
        id: trimmed,
        name: trimmed,
        nameEn: '',
        description: '',
        kind: 'custom',
        preset: false,
        position: 1000,
      })
    }
    const id = deriveCollectionId(trimmed)
    collectionsByName.set(nameKey(trimmed), id)
    return ensureCollection(id, {
      id,
      name: trimmed,
      nameEn: '',
      description: '',
      kind: 'custom',
      preset: false,
      position: 1000,
    })
  }

  for (const [index, def] of (file.collections ?? []).entries()) {
    const path = `collections.${index}`
    const preset = (def.id ? findPreset(def.id) : undefined) ?? findPreset(def.name)
    if (!def.name.trim()) {
      errors.push(error(`${path}.name`, 'empty_name', '词集名称不能为空。'))
      continue
    }
    if (preset) {
      if (def.id && def.id !== preset.id) {
        warnings.push(warn(path, 'preset_merged', `「${def.name}」并入预置专题「${preset.name}」。`))
      }
      ensureCollection(preset.id, collectionIds.has(preset.id)
        ? null
        : {
            id: preset.id,
            name: preset.name,
            nameEn: preset.nameEn,
            description: preset.description,
            kind: 'topic',
            preset: true,
            position: preset.position,
          })
      continue
    }
    if (def.id && !isStableId(def.id)) {
      errors.push(error(`${path}.id`, 'bad_id', `词集 id「${def.id}」只能包含字母、数字、下划线和连字符。`))
      continue
    }
    const id = def.id ?? deriveCollectionId(def.name)
    collectionsByName.set(nameKey(def.name), id)
    if (!collectionIds.has(id)) {
      ensureCollection(id, {
        id,
        name: def.name.trim(),
        nameEn: '',
        description: def.description?.trim() ?? '',
        kind: def.kind ?? 'custom',
        preset: false,
        position: 1000,
      })
    }
  }

  function resolveTag(name: string, path: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) {
      errors.push(error(path, 'empty_tag', '标签不能为空。'))
      return null
    }
    const existing = tagsByName.get(nameKey(trimmed))
    if (existing) return existing
    const id = deriveTagId(trimmed)
    tagsByName.set(nameKey(trimmed), id)
    if (!tagsToCreate.some((tag) => tag.id === id) && !ctx.tags.some((tag) => tag.id === id)) {
      tagsToCreate.push({ id, name: trimmed })
    }
    return id
  }

  const seenIds = new Map<string, number>()
  const fileFronts = new Map<string, string>()
  const cards: PlannedCard[] = []
  const knownTypes = new Set<string>(CARD_TYPES)

  for (const [index, card] of (file.cards ?? []).entries()) {
    const path = `cards.${index}`
    const cardErrors = semanticCardErrors(card, path)
    errors.push(...cardErrors)
    if (cardErrors.length > 0) continue
    const frontText = card.front.text.trim()
    const type = card.type.trim()
    let id = card.id?.trim() ?? ''
    if (id && !isStableId(id)) {
      errors.push(error(`${path}.id`, 'bad_id', `卡片 id「${id}」只能包含字母、数字、下划线和连字符，且不能太长。`))
      continue
    }
    if (!id) id = deriveCardId(type, frontText)
    if (seenIds.has(id)) {
      errors.push(error(`${path}.id`, 'duplicate_id', `文件里有重复的卡片 id「${id}」。请给每张卡一个稳定 id。`))
      continue
    }
    seenIds.set(id, index)

    const cardWarnings: ImportIssue[] = []
    if (!knownTypes.has(type)) {
      cardWarnings.push(warn(`${path}.type`, 'unknown_card_type', `不认识的卡片类型「${type}」，仍会导入，并按原文显示。`))
    }
    const key = frontKey(type, frontText)
    const otherFile = fileFronts.get(key)
    const otherLibrary = knownFronts.get(key)
    if ((otherFile && otherFile !== id) || (otherLibrary && otherLibrary !== id)) {
      cardWarnings.push(warn(path, 'possible_duplicate', `「${frontText}」和另一张同类型卡片很像。如果是同一张，请使用同一个 id。`))
    }
    fileFronts.set(key, id)

    const collectionIdsForCard: string[] = []
    for (const [refIndex, ref] of (card.collections ?? []).entries()) {
      const resolved = resolveCollection(ref, `${path}.collections.${refIndex}`)
      if (resolved && !collectionIdsForCard.includes(resolved)) collectionIdsForCard.push(resolved)
    }
    const tagIds: string[] = []
    for (const [tagIndex, tag] of (card.tags ?? []).entries()) {
      const resolved = resolveTag(tag, `${path}.tags.${tagIndex}`)
      if (resolved && !tagIds.includes(resolved)) tagIds.push(resolved)
    }
    const blocks = blocksOf(card)
    warnings.push(...cardWarnings)
    cards.push({
      action: knownCardIds.has(id) ? 'update' : 'create',
      id,
      type,
      frontText,
      backText: card.back?.text.trim() ?? '',
      blocks,
      collectionIds: collectionIdsForCard,
      tagIds,
      warnings: cardWarnings,
    })
  }

  if (errors.length > 0) {
    return { errors, warnings, cards: [], collectionsToCreate: [], tagsToCreate: [] }
  }
  return { errors, warnings, cards, collectionsToCreate, tagsToCreate }
}

function semanticCardErrors(card: ImportFileCard, path: string): ImportIssue[] {
  const found: ImportIssue[] = []
  if (!card.type.trim()) found.push(error(`${path}.type`, 'empty_type', '卡片类型不能为空。'))
  if (!card.front.text.trim()) found.push(error(`${path}.front.text`, 'empty_front', '卡片正面不能为空。'))
  return found
}

function blocksOf(card: ImportFileCard): PlannedBlock[] {
  const raw = [...(card.notes ?? []), ...(card.blocks ?? [])]
  const blocks: PlannedBlock[] = []
  for (const block of raw) {
    const content = block.content.trim()
    const type = block.type.trim()
    if (!content || !type) continue
    blocks.push({ type, content })
  }
  return blocks
}
