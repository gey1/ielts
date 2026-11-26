import { z } from 'zod'
import type { ImportIssue } from '../../domain/types.ts'

const blockSchema = z.object({
  type: z.string().max(40),
  content: z.string().max(8000),
}).strict()

const cardSchema = z.object({
  id: z.string().max(80).optional(),
  type: z.string().max(40),
  front: z.object({ text: z.string().max(500) }).strict(),
  back: z.object({ text: z.string().max(4000) }).strict().optional(),
  notes: z.array(blockSchema).max(40).optional(),
  blocks: z.array(blockSchema).max(40).optional(),
  collections: z.array(z.string().max(80)).max(40).optional(),
  tags: z.array(z.string().max(40)).max(40).optional(),
}).strict()

const collectionSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(80),
  kind: z.enum(['topic', 'custom']).optional(),
  description: z.string().max(300).optional(),
}).strict()

const fileSchema = z.object({
  schema_version: z.literal(1),
  collections: z.array(collectionSchema).max(200).optional(),
  cards: z.array(cardSchema).max(2000).optional(),
}).strict()

export type ImportFile = z.infer<typeof fileSchema>
export type ImportFileCard = ImportFile['cards'] extends (infer C)[] | undefined ? C : never
export type ImportFileCollection = NonNullable<ImportFile['collections']>[number]

export type ParseResult =
  | { ok: true; file: ImportFile }
  | { ok: false; errors: ImportIssue[] }

function issue(path: string, code: string, message: string): ImportIssue {
  return { path, code, message, level: 'error' }
}

function describe(path: string, code: string): string {
  const where = path || '文件'
  if (code === 'unrecognized_keys') return `${where} 含有不支持的字段。请只使用说明文档里的字段。`
  if (path === 'schema_version' || path.endsWith('schema_version')) {
    return 'schema_version 必须是数字 1。'
  }
  if (code === 'too_big') return `${where} 太长或数量太多。`
  return `${where} 的格式不正确。`
}

export function parseImport(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: [issue('', 'type', 'JSON 的根节点必须是对象。')] }
  }
  const version = (raw as { schema_version?: unknown }).schema_version
  if (version !== 1) {
    const shown = version === undefined ? '缺失' : JSON.stringify(version)
    return {
      ok: false,
      errors: [issue('schema_version', 'schema_version', `不支持的 schema_version（${shown}）。这个版本的词径只读取 1。`)],
    }
  }
  const parsed = fileSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((item) => {
        const path = item.path.join('.')
        return issue(path || '', item.code, describe(path, item.code))
      }),
    }
  }
  const file = parsed.data
  if ((file.cards?.length ?? 0) === 0 && (file.collections?.length ?? 0) === 0) {
    return { ok: false, errors: [issue('', 'empty', '文件里没有卡片，也没有词集。')] }
  }
  return { ok: true, file }
}
