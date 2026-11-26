export const APP_NAME = '词径'
export const DB_NAME = 'cijing'
export const SCHEMA_VERSION = 1
export const BACKUP_VERSION = 1
export const MASTERED_STABILITY_DAYS = 21
export const DEFAULT_DAILY_NEW = 10
export const DEFAULT_DAILY_EXERCISES = 5

export interface PresetTopic {
  id: string
  name: string
  nameEn: string
  description: string
  position: number
}

export const PRESETS: PresetTopic[] = [
  { id: 'topic-education', name: '教育', nameEn: 'Education', description: '学校、课程与学习', position: 0 },
  { id: 'topic-environment', name: '环境', nameEn: 'Environment', description: '气候、污染与资源', position: 1 },
  { id: 'topic-technology', name: '科技', nameEn: 'Technology', description: '数字生活与创新', position: 2 },
  { id: 'topic-healthcare', name: '医疗', nameEn: 'Healthcare', description: '健康与公共卫生', position: 3 },
  { id: 'topic-economics', name: '经济', nameEn: 'Economics', description: '市场、物价与增长', position: 4 },
  { id: 'topic-employment', name: '就业', nameEn: 'Employment', description: '工作、职业与劳动', position: 5 },
  { id: 'topic-society', name: '社会', nameEn: 'Society', description: '家庭、社区与公平', position: 6 },
  { id: 'topic-culture', name: '文化', nameEn: 'Culture', description: '传统、艺术与身份', position: 7 },
  { id: 'topic-government', name: '政府', nameEn: 'Government', description: '政策与公共事务', position: 8 },
  { id: 'topic-globalisation', name: '全球化', nameEn: 'Globalisation', description: '跨国联系与流动', position: 9 },
]

export const CARD_TYPE_LABELS: Record<string, string> = {
  vocabulary: '词汇',
  collocation: '搭配',
  paraphrasing: '改写',
  sentence_structure: '句型',
  grammar_pattern: '语法',
  register: '语体',
}

export const BLOCK_LABELS: Record<string, string> = {
  definition: '释义',
  translation: '中文',
  example: '例句',
  pronunciation: '发音',
  synonyms: '近义词',
  antonyms: '反义词',
  collocations: '搭配',
  grammar: '语法',
  usage_note: '用法',
  common_mistakes: '常见错误',
}

export const FRONT_BLOCK_TYPES = new Set(['pronunciation'])

export const RATING_LABELS: Record<number, { zh: string; en: string }> = {
  1: { zh: '重来', en: 'Again' },
  2: { zh: '困难', en: 'Hard' },
  3: { zh: '良好', en: 'Good' },
  4: { zh: '容易', en: 'Easy' },
}

export function findPreset(ref: string): PresetTopic | undefined {
  const trimmed = ref.trim()
  const key = trimmed.toLowerCase()
  return PRESETS.find(
    (preset) => preset.id.toLowerCase() === key || preset.name === trimmed || preset.nameEn.toLowerCase() === key,
  )
}

export function cardTypeLabel(type: string): string {
  return CARD_TYPE_LABELS[type] ?? type
}

export function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? type
}

export function ratingLabel(rating: number): string {
  return RATING_LABELS[rating]?.zh ?? '调整'
}
