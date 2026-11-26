import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import starter from '../../examples/ielts-starter.json'
import template from '../../examples/template.json'
import { cardTypeLabel } from '../domain/constants.ts'
import { formatDateTime } from '../domain/time.ts'
import { db } from '../services/db/db.ts'
import { commitImport, previewImport, rollbackImport, RollbackRejected, type PreviewResult } from '../services/import/commit.ts'
import type { ImportBatch, ImportIssue } from '../domain/types.ts'
import { downloadJson, messageOf } from '../ui/download.ts'
import { Modal } from '../ui/Modal.tsx'
import { useSnapshot } from '../ui/useSnapshot.ts'

type Stage =
  | { name: 'idle' }
  | { name: 'ready'; raw: unknown; filename: string | null; preview: PreviewResult }
  | { name: 'done'; batch: ImportBatch }

export function ImportPage() {
  const snapshot = useSnapshot()
  const batches = useLiveQuery(() => db.importBatches.orderBy('createdAt').reverse().toArray(), [])
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rollbackId, setRollbackId] = useState<string | null>(null)
  if (!snapshot) return null
  const latestApplied = batches?.find((batch) => batch.status === 'applied')

  async function review(rawText: string, filename: string | null) {
    setError('')
    let raw: unknown
    try {
      raw = JSON.parse(rawText)
    } catch {
      setStage({ name: 'idle' })
      setError('这不是有效的 JSON。请检查逗号、引号和括号。')
      return
    }
    const preview = await previewImport(raw)
    setStage({ name: 'ready', raw, filename, preview })
  }

  async function confirm() {
    if (stage.name !== 'ready' || !stage.preview.ok) return
    setBusy(true)
    setError('')
    try {
      const batch = await commitImport(stage.raw, stage.filename)
      setStage({ name: 'done', batch })
      setText('')
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  async function rollback(id: string) {
    setError('')
    try {
      await rollbackImport(id)
      setRollbackId(null)
    } catch (caught) {
      if (caught instanceof RollbackRejected) setError(caught.message)
      else setError(messageOf(caught))
      setRollbackId(null)
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>导入</h1>
          <p className="lede">
            先检查，再写入。同一张卡用同一个 id 再次导入时，只更新内容，复习进度保留。不确定的内容不会悄悄跳过。
          </p>
        </div>
      </div>
      <div className="cluster">
        <button
          type="button"
          className="btn primary"
          data-testid="import-example"
          onClick={() => {
            const pretty = JSON.stringify(starter, null, 2)
            setText(pretty)
            void review(pretty, 'ielts-starter.json')
          }}
        >
          载入示例词库
        </button>
        <button type="button" className="btn ghost" onClick={() => downloadJson('cijing-template.json', template)}>
          下载 JSON 模板
        </button>
      </div>
      <div className="import-grid">
        <div className="stack">
          <label className="field">
            <span>选择文件</span>
            <input
              type="file"
              accept="application/json,.json,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file.text().then((value) => {
                  setText(value)
                  void review(value, file.name)
                })
              }}
            />
          </label>
          <label className="field">
            <span>或粘贴 JSON</span>
            <textarea rows={14} value={text} spellCheck={false} onChange={(event) => setText(event.target.value)} />
          </label>
          <button type="button" className="btn ghost" onClick={() => void review(text, null)}>检查</button>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="panel">
          {stage.name === 'idle' && <p className="muted">检查之后，这里会列出将新增和将更新的卡片。确认前不会写入。</p>}
          {stage.name === 'ready' && <Preview preview={stage.preview} snapshotNames={nameMap(snapshot, stage.preview)} />}
          {stage.name === 'ready' && (
            <button
              type="button"
              className="btn primary"
              data-testid="import-confirm"
              disabled={!stage.preview.ok || busy}
              onClick={() => void confirm()}
            >
              {busy ? '正在写入…' : '确认导入'}
            </button>
          )}
          {stage.name === 'done' && (
            <div>
              <h2>已导入</h2>
              <p>新增 {stage.batch.summary.created} 张，更新 {stage.batch.summary.updated} 张。</p>
              <Link className="btn ghost" to="/cards">去词卡</Link>
            </div>
          )}
        </div>
      </div>
      <section className="panel">
        <h2>导入记录</h2>
        {!batches || batches.length === 0 ? (
          <p className="muted">还没有导入。撤销会删除该批次新增的卡片（含之后的复习），并把更新过的卡片恢复成导入前的文字。已有卡片的复习进度保持不变。</p>
        ) : (
          <ul className="plain-list">
            {batches.map((batch) => (
              <li key={batch.id}>
                <span>
                  {formatDateTime(new Date(batch.createdAt))}
                  {batch.filename ? ` · ${batch.filename}` : ''}
                  {' · '}
                  {batch.status === 'applied' ? '已导入' : '已撤销'}
                  {' · '}
                  新增 {batch.summary.created} / 更新 {batch.summary.updated}
                </span>
                {batch.status === 'applied' && (
                  <button
                    type="button"
                    className="btn small ghost"
                    disabled={latestApplied?.id !== batch.id}
                    onClick={() => setRollbackId(batch.id)}
                  >
                    {latestApplied?.id === batch.id ? '撤销' : '需先撤销更新的一批'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {rollbackId && (
        <Modal title="撤销这批导入？">
          <p>新增的卡片会被删除，包括导入之后你对它们的修改和复习记录。被更新的卡片会回到导入前的内容，复习进度不动。如果后来又导入过，请先撤销最新的一批。</p>
          <div className="cluster">
            <button type="button" className="btn danger" onClick={() => void rollback(rollbackId)}>撤销</button>
            <button type="button" className="btn ghost" onClick={() => setRollbackId(null)}>取消</button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function nameMap(snapshot: NonNullable<ReturnType<typeof useSnapshot>>, preview: PreviewResult): Map<string, string> {
  const names = new Map(snapshot.collections.map((item) => [item.id, item.name]))
  for (const collection of preview.plan?.collectionsToCreate ?? []) names.set(collection.id, collection.name)
  return names
}

function Preview({ preview, snapshotNames }: { preview: PreviewResult; snapshotNames: Map<string, string> }) {
  return (
    <div className="stack">
      <h2>{preview.ok ? '可以导入' : '先改文件'}</h2>
      {preview.plan && (
        <p>
          新增 {preview.plan.cards.filter((card) => card.action === 'create').length} 张，
          更新 {preview.plan.cards.filter((card) => card.action === 'update').length} 张，
          新词集 {preview.plan.collectionsToCreate.length} 个。
        </p>
      )}
      <Issues items={preview.errors} />
      <Issues items={preview.warnings} />
      {preview.plan && preview.plan.cards.length > 0 && (
        <ul className="plain-list">
          {preview.plan.cards.slice(0, 40).map((card) => (
            <li key={card.id}>
              <span lang="en">{card.frontText}</span>
              <span>
                {card.action === 'create' ? '新增' : '更新'} · {cardTypeLabel(card.type)}
                {card.collectionIds.length > 0 && ` · ${card.collectionIds.map((id) => snapshotNames.get(id) ?? id).join(' / ')}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {preview.plan && preview.plan.cards.length > 40 && <p className="muted">还有 {preview.plan.cards.length - 40} 张，确认后会一并写入。</p>}
    </div>
  )
}

function Issues({ items }: { items: ImportIssue[] }) {
  if (items.length === 0) return null
  return (
    <ul className={items[0]?.level === 'error' ? 'issue-list error' : 'issue-list'}>
      {items.map((item, index) => (
        <li key={`${item.path}-${item.code}-${index}`}>
          {item.path && <code>{item.path}</code>} {item.message}
        </li>
      ))}
    </ul>
  )
}
