import { BACKUP_VERSION } from '../../domain/constants.ts'
import type { BackupFile, ImportIssue, Settings } from '../../domain/types.ts'
import { db, ensureFoundation } from '../db/db.ts'

const TABLES = [
  'cards',
  'blocks',
  'collections',
  'tags',
  'cardCollections',
  'cardTags',
  'srsRecords',
  'reviewLogs',
  'importBatches',
] as const

export async function buildBackup(): Promise<BackupFile> {
  const settings = await db.settings.get('app')
  if (!settings) throw new Error('设置还没有准备好。')
  const [cards, blocks, collections, tags, cardCollections, cardTags, srsRecords, reviewLogs, importBatches] =
    await Promise.all([
      db.cards.toArray(),
      db.blocks.toArray(),
      db.collections.toArray(),
      db.tags.toArray(),
      db.cardCollections.toArray(),
      db.cardTags.toArray(),
      db.srsRecords.toArray(),
      db.reviewLogs.toArray(),
      db.importBatches.toArray(),
    ])
  return {
    backup_version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    app: 'cijing',
    cards,
    blocks,
    collections,
    tags,
    cardCollections,
    cardTags,
    srsRecords,
    reviewLogs,
    importBatches,
    settings,
  }
}

export function inspectBackup(raw: unknown): { ok: true; file: BackupFile } | { ok: false; errors: ImportIssue[] } {
  const errors = validateBackup(raw)
  if (errors.length) return { ok: false, errors }
  return { ok: true, file: raw as BackupFile }
}

function issue(path: string, message: string): ImportIssue {
  return { path, code: 'backup', message, level: 'error' }
}

function validateBackup(raw: unknown): ImportIssue[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return [issue('', '备份文件的根节点必须是对象。')]
  }
  const record = raw as Record<string, unknown>
  if (record.backup_version !== 1) {
    return [issue('backup_version', '这份备份不是词径备份版本 1。内容导入请走「导入 JSON」，不要用恢复备份。')]
  }
  if (record.app !== 'cijing') return [issue('app', '这不是词径导出的备份。')]
  const errors: ImportIssue[] = []
  for (const key of TABLES) {
    if (!Array.isArray(record[key])) errors.push(issue(key, `缺少 ${key} 数组。`))
    else if ((record[key] as unknown[]).some((row) => !row || typeof row !== 'object' || typeof (row as { id?: unknown }).id !== 'string')) {
      errors.push(issue(key, `${key} 里有缺少 id 的记录。为避免写坏数据，已整份拒绝。`))
    }
  }
  const settings = record.settings
  if (!settings || typeof settings !== 'object' || (settings as Settings).id !== 'app') {
    errors.push(issue('settings', '备份里的设置不完整。'))
  }
  return errors
}

export async function restoreBackup(raw: unknown): Promise<void> {
  const inspected = inspectBackup(raw)
  if (!inspected.ok) {
    throw new Error(inspected.errors.map((item) => item.message).join('\n'))
  }
  const file = inspected.file
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
      db.settings,
    ],
    async () => {
      await db.cards.clear()
      await db.blocks.clear()
      await db.collections.clear()
      await db.tags.clear()
      await db.cardCollections.clear()
      await db.cardTags.clear()
      await db.srsRecords.clear()
      await db.reviewLogs.clear()
      await db.importBatches.clear()
      await db.settings.clear()
      await db.cards.bulkAdd(file.cards)
      await db.blocks.bulkAdd(file.blocks)
      await db.collections.bulkAdd(file.collections)
      await db.tags.bulkAdd(file.tags)
      await db.cardCollections.bulkAdd(file.cardCollections)
      await db.cardTags.bulkAdd(file.cardTags)
      await db.srsRecords.bulkAdd(file.srsRecords)
      await db.reviewLogs.bulkAdd(file.reviewLogs)
      await db.importBatches.bulkAdd(file.importBatches)
      await db.settings.put(file.settings)
    },
  )
  await ensureFoundation()
}
