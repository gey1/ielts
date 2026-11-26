import type { Skill } from '../../domain/types.ts'
import { answersMatch, makeCloze } from './grade.ts'

export const EXERCISE_TYPES = [
  'recognition',
  'recall',
  'cloze',
  'translate',
  'paraphrase',
  'sentence',
] as const

export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export interface ExerciseCard {
  id: string
  type: string
  frontText: string
  backText: string
  blocks: { type: string; content: string }[]
}

export interface BuiltExercise {
  type: ExerciseType
  skill: Skill
  cardId: string
  objective: boolean
  prompt: string
  detail: string
  choices?: { id: string; label: string }[]
  expected?: string
  modelAnswer: string
}

export const EXERCISE_META: Record<ExerciseType, { label: string; skill: Skill; blurb: string }> = {
  recognition: {
    label: '识别',
    skill: 'recognition',
    blurb: '看见释义，认出英文。这项不计入掌握。',
  },
  recall: {
    label: '根据释义回忆',
    skill: 'recall',
    blurb: '从释义或中文写出英文。这是回忆，会计入这张卡的复习。',
  },
  cloze: {
    label: '填空',
    skill: 'application',
    blurb: '在例句里补上目标词。计入运用，不单独算掌握。',
  },
  translate: {
    label: '中译英',
    skill: 'application',
    blurb: '把中文写成英文。计入运用。',
  },
  paraphrase: {
    label: '改写',
    skill: 'application',
    blurb: '没有标准唯一答案。对照参考后，按自己的把握评分。',
  },
  sentence: {
    label: '造句',
    skill: 'application',
    blurb: '用这个词或结构写一句能拿去口语或写作的话。',
  },
}

function block(card: ExerciseCard, type: string): string | undefined {
  return card.blocks.find((item) => item.type === type && item.content.trim())?.content.trim()
}

function rng(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items]
  const random = rng(seed)
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const left = copy[i]!
    copy[i] = copy[j]!
    copy[j] = left
  }
  return copy
}

export function isAvailable(type: ExerciseType, card: ExerciseCard, pool: ExerciseCard[]): boolean {
  if (!card.frontText.trim()) return false
  if (type === 'recognition') {
    const prompt = block(card, 'definition') || card.backText.trim()
    const distractors = pool.filter((item) => item.id !== card.id && item.frontText.trim() && normalize(item.frontText) !== normalize(card.frontText))
    return Boolean(prompt) && distractors.length > 0
  }
  if (type === 'recall') {
    const prompt = block(card, 'definition') || card.backText.trim()
    return Boolean(prompt) && normalize(prompt) !== normalize(card.frontText)
  }
  if (type === 'cloze') {
    return card.blocks.some((item) => item.type === 'example' && makeCloze(item.content, card.frontText) !== null)
  }
  if (type === 'translate') return Boolean(card.backText.trim() || block(card, 'translation'))
  if (type === 'paraphrase') return card.type === 'paraphrasing' && Boolean(card.backText.trim())
  return true
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function buildExercise(
  type: ExerciseType,
  card: ExerciseCard,
  pool: ExerciseCard[],
  seed: number,
): BuiltExercise | null {
  if (!isAvailable(type, card, pool)) return null
  const meta = EXERCISE_META[type]
  if (type === 'recognition') {
    const definition = block(card, 'definition')
    const chinese = card.backText.trim()
    const distractors = shuffle(
      pool.filter((item) => item.id !== card.id && normalize(item.frontText) !== normalize(card.frontText)),
      seed,
    ).slice(0, 3)
    const choices = shuffle(
      [{ id: card.id, label: card.frontText }, ...distractors.map((item) => ({ id: item.id, label: item.frontText }))],
      seed + 17,
    )
    return {
      type,
      skill: meta.skill,
      cardId: card.id,
      objective: true,
      prompt: definition || `「${chinese}」对应的英文是？`,
      detail: definition && chinese ? chinese : '选出英文',
      choices,
      expected: card.id,
      modelAnswer: card.frontText,
    }
  }
  if (type === 'recall') {
    const definition = block(card, 'definition')
    return {
      type,
      skill: meta.skill,
      cardId: card.id,
      objective: true,
      prompt: definition || card.backText.trim(),
      detail: definition ? '根据释义写出英文' : '根据中文写出英文',
      expected: card.frontText,
      modelAnswer: card.frontText,
    }
  }
  if (type === 'cloze') {
    const example = card.blocks.find((item) => item.type === 'example' && makeCloze(item.content, card.frontText))
    const cloze = example ? makeCloze(example.content, card.frontText) : null
    if (!cloze) return null
    return {
      type,
      skill: meta.skill,
      cardId: card.id,
      objective: true,
      prompt: cloze.prompt,
      detail: '补上空缺的词或搭配',
      expected: cloze.answer,
      modelAnswer: cloze.answer,
    }
  }
  if (type === 'translate') {
    const chinese = card.backText.trim() || block(card, 'translation') || ''
    return {
      type,
      skill: meta.skill,
      cardId: card.id,
      objective: true,
      prompt: chinese,
      detail: '写成英文',
      expected: card.frontText,
      modelAnswer: card.frontText,
    }
  }
  if (type === 'paraphrase') {
    const note = block(card, 'usage_note')
    return {
      type,
      skill: meta.skill,
      cardId: card.id,
      objective: false,
      prompt: '把下面的表达改写成更适合雅思写作或口语的英文。',
      detail: card.frontText,
      modelAnswer: note ? `${card.backText.trim()}\n${note}` : card.backText.trim(),
    }
  }
  const example = block(card, 'example')
  return {
    type,
    skill: meta.skill,
    cardId: card.id,
    objective: false,
    prompt: `用「${card.frontText}」写一个英文句子。`,
    detail: '写成你在口语或写作里真的会说的话。',
    modelAnswer: example || card.backText.trim() || '这张卡没有例句。只要用对了这个词或结构，就可以按把握评分。',
  }
}

export function gradeBuilt(exercise: BuiltExercise, response: string): { correct: boolean; feedback: string } {
  if (!exercise.objective) {
    return { correct: false, feedback: exercise.modelAnswer }
  }
  if (exercise.type === 'recognition') {
    const correct = response === exercise.expected
    return {
      correct,
      feedback: correct ? '选对了。' : `应选「${exercise.modelAnswer}」。`,
    }
  }
  const correct = answersMatch(exercise.expected ?? '', response)
  return {
    correct,
    feedback: correct ? '答对了。' : `参考答案：${exercise.modelAnswer}`,
  }
}

export function programmeExercises(input: {
  sessionIds: string[]
  cards: ExerciseCard[]
  states: Map<string, number>
  limit: number
  seed: number
}): BuiltExercise[] {
  if (input.limit <= 0) return []
  const byId = new Map(input.cards.map((card) => [card.id, card]))
  const ordered: ExerciseCard[] = []
  for (const id of input.sessionIds) {
    const card = byId.get(id)
    if (card) ordered.push(card)
  }
  const rest = input.cards
    .filter((card) => !input.sessionIds.includes(card.id) && (input.states.get(card.id) ?? 0) !== 0)
    .sort((a, b) => a.frontText.localeCompare(b.frontText, 'en'))
  const result: BuiltExercise[] = []
  const used = new Set<string>()
  for (const card of [...ordered, ...rest]) {
    if (result.length >= input.limit) break
    if (used.has(card.id)) continue
    const type = preferredType(card, input.cards)
    if (!type) continue
    const built = buildExercise(type, card, input.cards, input.seed + result.length * 13)
    if (!built) continue
    used.add(card.id)
    result.push(built)
  }
  return result
}

function preferredType(card: ExerciseCard, pool: ExerciseCard[]): ExerciseType | null {
  if (card.type === 'paraphrasing' && isAvailable('paraphrase', card, pool)) return 'paraphrase'
  if ((card.type === 'sentence_structure' || card.type === 'grammar_pattern') && isAvailable('sentence', card, pool)) {
    return 'sentence'
  }
  if (isAvailable('cloze', card, pool)) return 'cloze'
  if (isAvailable('translate', card, pool)) return 'translate'
  if (isAvailable('sentence', card, pool)) return 'sentence'
  return null
}

export function practiceQueue(input: {
  type: ExerciseType
  cards: ExerciseCard[]
  dueIds: string[]
  learningIds: string[]
  limit: number
  seed: number
}): BuiltExercise[] {
  const rank = new Map<string, number>()
  input.dueIds.forEach((id, index) => rank.set(id, index))
  input.learningIds.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, 1000 + index)
  })
  const ordered = [...input.cards].sort((a, b) => {
    const left = rank.get(a.id) ?? 5000
    const right = rank.get(b.id) ?? 5000
    return left - right || a.frontText.localeCompare(b.frontText, 'en')
  })
  const built: BuiltExercise[] = []
  for (const card of ordered) {
    if (built.length >= input.limit) break
    const exercise = buildExercise(input.type, card, input.cards, input.seed + built.length)
    if (exercise) built.push(exercise)
  }
  return built
}
