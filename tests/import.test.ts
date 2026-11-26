import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deriveCardId } from '../src/domain/ids.ts'
import { canCommit, planImport, type PlanContext } from '../src/services/import/plan.ts'
import { parseImport } from '../src/services/import/schema.ts'
import starter from '../examples/ielts-starter.json'
import template from '../examples/template.json'

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
    },
  ],
}

const emptyContext = (): PlanContext => ({ cards: [], collections: [], tags: [] })

describe('import schema', () => {
  it('accepts the documented baseline and derives a stable id', () => {
    const parsed = parseImport(baseline)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const plan = planImport(parsed.file, emptyContext())
    expect(canCommit(plan)).toBe(true)
    expect(plan.cards[0]?.id).toBe(deriveCardId('vocabulary', 'Deteriorate'))
    expect(plan.cards[0]?.blocks.map((block) => block.type)).toEqual(['definition', 'example'])
    expect(plan.cards[0]?.backText).toBe('恶化；变坏')
  })

  it('rejects a newer schema version without writing a partial plan', () => {
    const parsed = parseImport({ schema_version: 2, cards: [] })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.errors[0]?.code).toBe('schema_version')
  })

  it('rejects duplicate ids and unknown keys', () => {
    const duplicate = parseImport({
      schema_version: 1,
      cards: [
        { id: 'same', type: 'vocabulary', front: { text: 'One' } },
        { id: 'same', type: 'vocabulary', front: { text: 'Two' } },
      ],
    })
    expect(duplicate.ok).toBe(true)
    if (!duplicate.ok) return
    const plan = planImport(duplicate.file, emptyContext())
    expect(plan.errors.some((issue) => issue.code === 'duplicate_id')).toBe(true)
    expect(canCommit(plan)).toBe(false)

    const extra = parseImport({
      schema_version: 1,
      cards: [{ type: 'vocabulary', front: { text: 'One' }, html: '<script>' }],
    })
    expect(extra.ok).toBe(false)
  })

  it('maps topic names onto presets and warns about lookalike cards', () => {
    const parsed = parseImport(template)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const plan = planImport(parsed.file, {
      cards: [{ id: 'other', type: 'vocabulary', frontText: 'Deteriorate' }],
      collections: [{ id: 'topic-environment', name: '环境', nameEn: 'Environment' }],
      tags: [],
    })
    expect(plan.errors).toEqual([])
    const deteriorate = plan.cards.find((card) => card.id === 'vocab-deteriorate')
    expect(deteriorate?.action).toBe('create')
    expect(deteriorate?.collectionIds).toContain('topic-environment')
    expect(deteriorate?.warnings.some((issue) => issue.code === 'possible_duplicate')).toBe(true)
    expect(plan.collectionsToCreate.some((item) => item.id === 'topic-environment')).toBe(false)
    expect(plan.collectionsToCreate.some((item) => item.name === 'Writing task 2')).toBe(true)
    expect(deteriorate?.blocks.some((block) => block.type === 'band_tip')).toBe(true)
  })

  it('treats an existing id as an update', () => {
    const parsed = parseImport(baseline)
    if (!parsed.ok) throw new Error('parse failed')
    const id = deriveCardId('vocabulary', 'Deteriorate')
    const plan = planImport(parsed.file, {
      cards: [{ id, type: 'vocabulary', frontText: 'Deteriorate' }],
      collections: [],
      tags: [],
    })
    expect(plan.cards[0]?.action).toBe('update')
  })

  it('parses the starter pack', () => {
    const parsed = parseImport(starter)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const plan = planImport(parsed.file, {
      cards: [],
      collections: [
        { id: 'topic-environment', name: '环境', nameEn: 'Environment' },
        { id: 'topic-education', name: '教育', nameEn: 'Education' },
      ],
      tags: [],
    })
    expect(plan.errors).toEqual([])
    expect(plan.cards.length).toBeGreaterThan(10)
    expect(plan.cards.every((card) => card.collectionIds.length > 0)).toBe(true)
  })

  it('keeps the import service independent of React and the scheduler', () => {
    const source = ['schema.ts', 'plan.ts', 'commit.ts']
      .map((name) => readFileSync(new URL(`../src/services/import/${name}`, import.meta.url), 'utf8'))
      .join('\n')
    expect(source).not.toMatch(/ts-fsrs|from 'react'|from "react"/)
  })
})
